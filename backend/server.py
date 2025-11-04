from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Literal, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from emergentintegrations.llm.openai import OpenAIChatRealtime, UserMessage
import jwt
from passlib.context import CryptContext
import json
import base64
import io
from elevenlabs import ElevenLabs, VoiceSettings
import asyncio
from concurrent.futures import ThreadPoolExecutor

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

# ElevenLabs configuration
ELEVENLABS_API_KEY = os.environ.get('ELEVENLABS_API_KEY')

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Create the main app without a prefix
app = FastAPI(title="VoiceMirror - Advanced Voice Clone Stream API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging first
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize ElevenLabs client
try:
    if ELEVENLABS_API_KEY:
        eleven_client = ElevenLabs(api_key=ELEVENLABS_API_KEY)
        logger.info("ElevenLabs client initialized successfully")
        ELEVENLABS_AVAILABLE = True
    else:
        logger.warning("ElevenLabs API key not provided")
        ELEVENLABS_AVAILABLE = False
        eleven_client = None
except Exception as e:
    logger.error(f"Error initializing ElevenLabs: {e}")
    ELEVENLABS_AVAILABLE = False
    eleven_client = None

# Initialize OpenAI Realtime Chat with Emergent LLM key
EMERGENT_LLM_KEY = "sk-emergent-982703428D01aAb3c5"

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

# Thread pool for async operations
executor = ThreadPoolExecutor(max_workers=4)

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

class VoiceProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    voice_id: Optional[str] = None  # ElevenLabs voice ID
    voice_data: dict
    samples_count: int = 0
    training_status: str = "untrained"  # "untrained", "training", "ready", "failed"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True

class VoiceProfileCreate(BaseModel):
    name: str
    voice_data: Optional[dict] = None

class VoiceCloneRequest(BaseModel):
    voice_name: str
    description: Optional[str] = None

class VoiceCloneResponse(BaseModel):
    voice_id: str
    name: str
    status: str
    message: str

class TTSRequest(BaseModel):
    text: str
    voice_id: str
    stability: float = Field(default=0.75, ge=0.0, le=1.0)
    similarity_boost: float = Field(default=0.75, ge=0.0, le=1.0)
    style: float = Field(default=0.0, ge=0.0, le=1.0)
    use_speaker_boost: bool = True

class TTSResponse(BaseModel):
    audio_url: str
    text: str
    voice_id: str
    generation_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class STTRequest(BaseModel):
    audio_file: str  # Base64 encoded audio
    filename: str

class STTResponse(BaseModel):
    transcribed_text: str
    filename: str
    transcription_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Call(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    caller_id: str
    receiver_id: Optional[str] = None
    call_type: str = Field(default="voice_clone")
    status: str = Field(default="waiting")
    room_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ended_at: Optional[datetime] = None
    voice_settings: Optional[dict] = None

class CallCreate(BaseModel):
    receiver_email: Optional[str] = None
    call_type: str = "voice_clone"
    voice_settings: Optional[dict] = None

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

def run_sync(func):
    """Run sync function in thread pool"""
    loop = asyncio.get_event_loop()
    return loop.run_in_executor(executor, func)

# Authentication Routes
@api_router.post("/auth/register", response_model=UserResponse)
async def register(user_data: UserCreate):
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = User(
        username=user_data.username,
        email=user_data.email
    )
    
    user_dict = user.model_dump()
    user_dict['password_hash'] = hash_password(user_data.password)
    user_dict = prepare_for_mongo(user_dict)
    
    await db.users.insert_one(user_dict)
    
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
    user_doc = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(user_data.password, user_doc['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    user_doc = parse_from_mongo(user_doc)
    user = User(**{k: v for k, v in user_doc.items() if k != 'password_hash'})
    
    token = create_access_token(data={"sub": user.id})
    
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        voice_profile_id=user.voice_profile_id,
        token=token
    )

# Advanced Voice Cloning Routes
@api_router.get("/voices/available")
async def get_available_voices():
    """Get all available ElevenLabs voices"""
    if not ELEVENLABS_AVAILABLE:
        raise HTTPException(status_code=503, detail="ElevenLabs service not available")
    
    try:
        voices_response = await run_sync(lambda: eleven_client.voices.get_all())
        return {
            "voices": [
                {
                    "voice_id": voice.voice_id,
                    "name": voice.name,
                    "category": voice.category if hasattr(voice, 'category') else 'generated',
                    "description": voice.description if hasattr(voice, 'description') else '',
                    "preview_url": voice.preview_url if hasattr(voice, 'preview_url') else None
                }
                for voice in voices_response.voices
            ]
        }
    except Exception as e:
        logger.error(f"Error fetching voices: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching voices: {str(e)}")

@api_router.post("/voices/clone", response_model=VoiceCloneResponse)
async def clone_voice(
    voice_name: str = Form(...),
    description: str = Form(""),
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_user)
):
    """Clone a voice using uploaded audio samples"""
    if not ELEVENLABS_AVAILABLE:
        raise HTTPException(status_code=503, detail="ElevenLabs service not available")
    
    try:
        # Validate files
        audio_files = []
        for file in files:
            if not file.content_type or not file.content_type.startswith('audio/'):
                raise HTTPException(status_code=400, detail=f"Invalid file type: {file.filename}")
            
            content = await file.read()
            audio_files.append((file.filename, content, file.content_type))
        
        # Clone voice using ElevenLabs
        def clone_voice_sync():
            return eleven_client.clone(
                name=voice_name,
                description=description,
                files=audio_files
            )
        
        voice_result = await run_sync(clone_voice_sync)
        
        # Create voice profile in database
        voice_profile = VoiceProfile(
            user_id=current_user.id,
            name=voice_name,
            voice_id=voice_result.voice_id,
            voice_data={
                "description": description,
                "elevenlabs_voice_id": voice_result.voice_id,
                "samples_count": len(files)
            },
            samples_count=len(files),
            training_status="ready"
        )
        
        profile_dict = voice_profile.model_dump()
        profile_dict = prepare_for_mongo(profile_dict)
        await db.voice_profiles.insert_one(profile_dict)
        
        # Update user's active voice profile
        await db.users.update_one(
            {"id": current_user.id},
            {"$set": {"voice_profile_id": voice_profile.id}}
        )
        
        return VoiceCloneResponse(
            voice_id=voice_result.voice_id,
            name=voice_name,
            status="ready",
            message="Voice cloned successfully"
        )
        
    except Exception as e:
        logger.error(f"Error cloning voice: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error cloning voice: {str(e)}")

@api_router.post("/tts/generate", response_model=TTSResponse)
async def generate_tts(
    request: TTSRequest,
    current_user: User = Depends(get_current_user)
):
    """Generate text-to-speech audio using ElevenLabs"""
    if not ELEVENLABS_AVAILABLE:
        raise HTTPException(status_code=503, detail="ElevenLabs service not available")
    
    try:
        # Generate audio using ElevenLabs
        voice_settings = VoiceSettings(
            stability=request.stability,
            similarity_boost=request.similarity_boost,
            style=request.style,
            use_speaker_boost=request.use_speaker_boost
        )
        
        def generate_tts_sync():
            return eleven_client.generate(
                text=request.text,
                voice=request.voice_id,
                voice_settings=voice_settings,
                model="eleven_multilingual_v2"
            )
        
        audio_generator = await run_sync(generate_tts_sync)
        
        # Collect audio data
        audio_data = b""
        for chunk in audio_generator:
            audio_data += chunk
        
        # Convert to base64 for storage/transfer
        audio_b64 = base64.b64encode(audio_data).decode()
        
        # Create response
        tts_response = TTSResponse(
            audio_url=f"data:audio/mpeg;base64,{audio_b64}",
            text=request.text,
            voice_id=request.voice_id
        )
        
        # Save to database
        tts_dict = prepare_for_mongo(tts_response.model_dump())
        await db.tts_generations.insert_one(tts_dict)
        
        return tts_response
        
    except Exception as e:
        logger.error(f"Error generating TTS: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating TTS: {str(e)}")

@api_router.post("/stt/transcribe", response_model=STTResponse)
async def transcribe_audio(
    audio_file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Transcribe audio file to text using ElevenLabs Speech-to-Text"""
    if not ELEVENLABS_AVAILABLE:
        raise HTTPException(status_code=503, detail="ElevenLabs service not available")
    
    try:
        # Read uploaded audio file
        audio_content = await audio_file.read()
        
        # Transcribe using ElevenLabs Speech-to-Text
        def transcribe_sync():
            return eleven_client.speech_to_text.convert(
                file=io.BytesIO(audio_content),
                model_id="scribe_v1"
            )
        
        transcription_response = await run_sync(transcribe_sync)
        
        # Extract text from response
        transcribed_text = transcription_response.text if hasattr(transcription_response, 'text') else str(transcription_response)
        
        # Create response
        stt_response = STTResponse(
            transcribed_text=transcribed_text,
            filename=audio_file.filename or "unknown.audio"
        )
        
        # Save to database
        stt_dict = prepare_for_mongo(stt_response.model_dump())
        await db.stt_transcriptions.insert_one(stt_dict)
        
        return stt_response
        
    except Exception as e:
        logger.error(f"Error transcribing audio: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error transcribing audio: {str(e)}")

# Voice Profile Routes
@api_router.post("/voice-profiles", response_model=VoiceProfile)
async def create_voice_profile(profile_data: VoiceProfileCreate, current_user: User = Depends(get_current_user)):
    profile = VoiceProfile(
        user_id=current_user.id,
        name=profile_data.name,
        voice_data=profile_data.voice_data or {
            "model": "nova",
            "voice": "alloy",
            "response_format": "pcm16",
            "instructions": "You are a helpful assistant that speaks clearly and naturally."
        }
    )
    
    profile_dict = profile.model_dump()
    profile_dict = prepare_for_mongo(profile_dict)
    
    await db.voice_profiles.insert_one(profile_dict)
    
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
    result = await db.calls.update_one(
        {"id": call_id, "$or": [{"caller_id": current_user.id}, {"receiver_id": current_user.id}]},
        {"$set": {"status": "active"}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Call not found")
    
    return {"status": "joined"}

@api_router.patch("/calls/{call_id}/end")
async def end_call(call_id: str, current_user: User = Depends(get_current_user)):
    result = await db.calls.update_one(
        {"id": call_id, "$or": [{"caller_id": current_user.id}, {"receiver_id": current_user.id}]},
        {"$set": {"status": "ended", "ended_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Call not found")
    
    return {"status": "ended"}

# System Status Routes
@api_router.get("/")
async def root():
    return {
        "message": "VoiceMirror - Advanced Voice Clone Stream API is running!", 
        "version": "2.0.0",
        "features": {
            "realtime_available": REALTIME_AVAILABLE,
            "elevenlabs_available": ELEVENLABS_AVAILABLE,
            "voice_cloning": ELEVENLABS_AVAILABLE,
            "text_to_speech": ELEVENLABS_AVAILABLE,
            "speech_to_text": ELEVENLABS_AVAILABLE
        }
    }

@api_router.get("/realtime/status")
async def realtime_status():
    """Check if OpenAI realtime features are available"""
    return {
        "available": REALTIME_AVAILABLE,
        "message": "OpenAI realtime voice cloning available" if REALTIME_AVAILABLE else "Basic WebRTC calling only"
    }

@api_router.get("/voice/status")
async def voice_status():
    """Check voice cloning service status"""
    return {
        "elevenlabs_available": ELEVENLABS_AVAILABLE,
        "voice_cloning": ELEVENLABS_AVAILABLE,
        "text_to_speech": ELEVENLABS_AVAILABLE,
        "speech_to_text": ELEVENLABS_AVAILABLE,
        "message": "Advanced voice cloning available" if ELEVENLABS_AVAILABLE else "Voice services not available"
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

# Logging already configured above

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
