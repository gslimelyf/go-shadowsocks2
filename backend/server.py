from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from emergentintegrations.llm.openai import OpenAIChatRealtime, UserMessage
import jwt
from passlib.context import CryptContext
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT settings
JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'voice-clone-secret-key-2024')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Create the main app without a prefix
app = FastAPI(title="Live Voice Clone Stream API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Initialize OpenAI Realtime Chat with Emergent LLM key
EMERGENT_LLM_KEY = "sk-emergent-982703428D01aAb3c5"

# Configure logging first
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Try to initialize OpenAI realtime integration
try:
    chat = OpenAIChatRealtime(api_key=EMERGENT_LLM_KEY)
    # Register OpenAI realtime router
    OpenAIChatRealtime.register_openai_realtime_router(api_router, chat)
    logger.info("OpenAI realtime integration initialized successfully")
    REALTIME_AVAILABLE = True
except Exception as e:
    logger.warning(f"OpenAI realtime integration not available: {e}")
    logger.info("Voice calls will use basic WebRTC without AI voice cloning")
    REALTIME_AVAILABLE = False
    chat = None

# Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    voice_profile_id: Optional[str] = None

class UserCreate(BaseModel):
    username: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    voice_profile_id: Optional[str] = None
    token: str

class Call(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    caller_id: str
    receiver_id: Optional[str] = None
    call_type: str = Field(default="voice_clone")  # "voice_clone", "regular"
    status: str = Field(default="waiting")  # "waiting", "active", "ended"
    room_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ended_at: Optional[datetime] = None
    voice_settings: Optional[dict] = None

class CallCreate(BaseModel):
    receiver_email: Optional[str] = None
    call_type: str = "voice_clone"
    voice_settings: Optional[dict] = None

class VoiceProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    voice_data: dict  # Contains voice cloning parameters
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True

class VoiceProfileCreate(BaseModel):
    name: str
    voice_data: dict

# Helper functions
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

def prepare_for_mongo(data: dict) -> dict:
    """Convert datetime objects to ISO strings for MongoDB storage"""
    for key, value in data.items():
        if isinstance(value, datetime):
            data[key] = value.isoformat()
    return data

def parse_from_mongo(item: dict) -> dict:
    """Convert ISO strings back to datetime objects"""
    for key, value in item.items():
        if key in ['created_at', 'ended_at'] and isinstance(value, str):
            try:
                item[key] = datetime.fromisoformat(value)
            except:
                pass
    return item

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user_doc = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user_doc is None:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_doc = parse_from_mongo(user_doc)
    return User(**user_doc)

# Authentication Routes
@api_router.post("/auth/register", response_model=UserResponse)
async def register(user_data: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create new user
    user = User(
        username=user_data.username,
        email=user_data.email
    )
    
    # Store user with hashed password
    user_dict = user.model_dump()
    user_dict['password_hash'] = hash_password(user_data.password)
    user_dict = prepare_for_mongo(user_dict)
    
    await db.users.insert_one(user_dict)
    
    # Create access token
    token = create_access_token(data={"sub": user.id})
    
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        voice_profile_id=user.voice_profile_id,
        token=token
    )

@api_router.post("/auth/login", response_model=UserResponse)
async def login(user_data: UserLogin):
    # Find user
    user_doc = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Verify password
    if not verify_password(user_data.password, user_doc['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    user_doc = parse_from_mongo(user_doc)
    user = User(**{k: v for k, v in user_doc.items() if k != 'password_hash'})
    
    # Create access token
    token = create_access_token(data={"sub": user.id})
    
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        voice_profile_id=user.voice_profile_id,
        token=token
    )

# Voice Profile Routes
@api_router.post("/voice-profiles", response_model=VoiceProfile)
async def create_voice_profile(profile_data: VoiceProfileCreate, current_user: User = Depends(get_current_user)):
    profile = VoiceProfile(
        user_id=current_user.id,
        name=profile_data.name,
        voice_data=profile_data.voice_data
    )
    
    profile_dict = profile.model_dump()
    profile_dict = prepare_for_mongo(profile_dict)
    
    await db.voice_profiles.insert_one(profile_dict)
    
    # Update user's active voice profile
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"voice_profile_id": profile.id}}
    )
    
    return profile

@api_router.get("/voice-profiles", response_model=List[VoiceProfile])
async def get_voice_profiles(current_user: User = Depends(get_current_user)):
    profiles = await db.voice_profiles.find({"user_id": current_user.id}, {"_id": 0}).to_list(length=None)
    
    for profile in profiles:
        profile = parse_from_mongo(profile)
    
    return [VoiceProfile(**profile) for profile in profiles]

# Call Management Routes
@api_router.post("/calls", response_model=Call)
async def create_call(call_data: CallCreate, current_user: User = Depends(get_current_user)):
    call = Call(
        caller_id=current_user.id,
        call_type=call_data.call_type,
        voice_settings=call_data.voice_settings
    )
    
    # If receiver email provided, find receiver
    if call_data.receiver_email:
        receiver = await db.users.find_one({"email": call_data.receiver_email}, {"_id": 0})
        if receiver:
            call.receiver_id = receiver['id']
    
    call_dict = call.model_dump()
    call_dict = prepare_for_mongo(call_dict)
    
    await db.calls.insert_one(call_dict)
    
    return call

@api_router.get("/calls", response_model=List[Call])
async def get_calls(current_user: User = Depends(get_current_user)):
    calls = await db.calls.find(
        {"$or": [{"caller_id": current_user.id}, {"receiver_id": current_user.id}]},
        {"_id": 0}
    ).to_list(length=None)
    
    for call in calls:
        call = parse_from_mongo(call)
    
    return [Call(**call) for call in calls]

@api_router.patch("/calls/{call_id}/join")
async def join_call(call_id: str, current_user: User = Depends(get_current_user)):
    # Update call status
    result = await db.calls.update_one(
        {"id": call_id, "$or": [{"caller_id": current_user.id}, {"receiver_id": current_user.id}]},
        {"$set": {"status": "active"}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Call not found")
    
    return {"status": "joined"}

@api_router.patch("/calls/{call_id}/end")
async def end_call(call_id: str, current_user: User = Depends(get_current_user)):
    # Update call status
    result = await db.calls.update_one(
        {"id": call_id, "$or": [{"caller_id": current_user.id}, {"receiver_id": current_user.id}]},
        {"$set": {"status": "ended", "ended_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Call not found")
    
    return {"status": "ended"}

# Basic health check
@api_router.get("/")
async def root():
    return {
        "message": "Live Voice Clone Stream API is running!", 
        "version": "1.0.0",
        "realtime_available": REALTIME_AVAILABLE
    }

@api_router.get("/realtime/status")
async def realtime_status():
    """Check if OpenAI realtime features are available"""
    return {
        "available": REALTIME_AVAILABLE,
        "message": "OpenAI realtime voice cloning available" if REALTIME_AVAILABLE else "Basic WebRTC calling only"
    }

@api_router.get("/users/me", response_model=User)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
