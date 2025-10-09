import requests
import sys
import json
from datetime import datetime

class VoiceMirrorAPITester:
    def __init__(self, base_url="https://voice-mirror-live.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test": name,
            "status": "PASS" if success else "FAIL",
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        status_icon = "✅" if success else "❌"
        print(f"{status_icon} {name}: {details}")

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            
            if success:
                try:
                    response_data = response.json()
                    details = f"Status: {response.status_code}"
                    if 'message' in response_data:
                        details += f", Message: {response_data['message']}"
                except:
                    response_data = {}
                    details = f"Status: {response.status_code}"
            else:
                try:
                    error_data = response.json()
                    details = f"Expected {expected_status}, got {response.status_code}. Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details = f"Expected {expected_status}, got {response.status_code}. Response: {response.text[:100]}"
                response_data = {}

            self.log_test(name, success, details)
            return success, response_data

        except requests.exceptions.RequestException as e:
            details = f"Network error: {str(e)}"
            self.log_test(name, False, details)
            return False, {}

    def test_health_check(self):
        """Test API health check"""
        success, response = self.run_test(
            "API Health Check",
            "GET",
            "",
            200
        )
        return success

    def test_register(self, username, email, password):
        """Test user registration"""
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data={
                "username": username,
                "email": email,
                "password": password
            }
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response['id']
            self.log_test("Token Extraction", True, f"Token received and stored")
        elif success:
            self.log_test("Token Extraction", False, "No token in registration response")
            
        return success

    def test_login(self, email, password):
        """Test user login"""
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data={
                "email": email,
                "password": password
            }
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response['id']
            self.log_test("Login Token Extraction", True, f"Login token received")
        elif success:
            self.log_test("Login Token Extraction", False, "No token in login response")
            
        return success

    def test_get_user_info(self):
        """Test getting current user info"""
        if not self.token:
            self.log_test("Get User Info", False, "No authentication token available")
            return False
            
        success, response = self.run_test(
            "Get Current User Info",
            "GET",
            "users/me",
            200
        )
        return success

    def test_create_voice_profile(self):
        """Test creating a voice profile"""
        if not self.token:
            self.log_test("Create Voice Profile", False, "No authentication token available")
            return False, None
            
        success, response = self.run_test(
            "Create Voice Profile",
            "POST",
            "voice-profiles",
            200,
            data={
                "name": "Test Voice Profile",
                "voice_data": {
                    "model": "nova",
                    "voice": "alloy",
                    "response_format": "pcm16",
                    "instructions": "Test voice profile for automated testing"
                }
            }
        )
        
        profile_id = response.get('id') if success else None
        return success, profile_id

    def test_get_voice_profiles(self):
        """Test getting voice profiles"""
        if not self.token:
            self.log_test("Get Voice Profiles", False, "No authentication token available")
            return False
            
        success, response = self.run_test(
            "Get Voice Profiles",
            "GET",
            "voice-profiles",
            200
        )
        return success

    def test_create_call(self, receiver_email=None):
        """Test creating a call"""
        if not self.token:
            self.log_test("Create Call", False, "No authentication token available")
            return False, None
            
        call_data = {
            "call_type": "voice_clone",
            "voice_settings": {
                "model": "nova",
                "voice": "alloy"
            }
        }
        
        if receiver_email:
            call_data["receiver_email"] = receiver_email
            
        success, response = self.run_test(
            "Create Call",
            "POST",
            "calls",
            200,
            data=call_data
        )
        
        call_id = response.get('id') if success else None
        room_id = response.get('room_id') if success else None
        return success, call_id, room_id

    def test_get_calls(self):
        """Test getting user calls"""
        if not self.token:
            self.log_test("Get Calls", False, "No authentication token available")
            return False
            
        success, response = self.run_test(
            "Get User Calls",
            "GET",
            "calls",
            200
        )
        return success

    def test_join_call(self, call_id):
        """Test joining a call"""
        if not self.token or not call_id:
            self.log_test("Join Call", False, "No authentication token or call ID available")
            return False
            
        success, response = self.run_test(
            "Join Call",
            "PATCH",
            f"calls/{call_id}/join",
            200
        )
        return success

    def test_end_call(self, call_id):
        """Test ending a call"""
        if not self.token or not call_id:
            self.log_test("End Call", False, "No authentication token or call ID available")
            return False
            
        success, response = self.run_test(
            "End Call",
            "PATCH",
            f"calls/{call_id}/end",
            200
        )
        return success

    def test_invalid_token(self):
        """Test API with invalid token"""
        original_token = self.token
        self.token = "invalid_token_12345"
        
        success, response = self.run_test(
            "Invalid Token Test",
            "GET",
            "users/me",
            401
        )
        
        self.token = original_token
        return success

    def run_comprehensive_test(self):
        """Run all tests in sequence"""
        print("🚀 Starting VoiceMirror API Comprehensive Test Suite")
        print("=" * 60)
        
        # Test unique user credentials
        timestamp = datetime.now().strftime("%H%M%S")
        test_username = f"testuser_{timestamp}"
        test_email = f"test_{timestamp}@example.com"
        test_password = "TestPass123!"
        
        # 1. Health Check
        print("\n📋 Testing API Health...")
        self.test_health_check()
        
        # 2. Authentication Tests
        print("\n🔐 Testing Authentication...")
        if self.test_register(test_username, test_email, test_password):
            self.test_get_user_info()
            
            # Test login with same credentials
            self.test_login(test_email, test_password)
        
        # 3. Voice Profile Tests
        print("\n🎤 Testing Voice Profiles...")
        profile_success, profile_id = self.test_create_voice_profile()
        self.test_get_voice_profiles()
        
        # 4. Call Management Tests
        print("\n📞 Testing Call Management...")
        call_success, call_id, room_id = self.test_create_call()
        self.test_get_calls()
        
        if call_success and call_id:
            self.test_join_call(call_id)
            self.test_end_call(call_id)
        
        # 5. Security Tests
        print("\n🔒 Testing Security...")
        self.test_invalid_token()
        
        # 6. Test with receiver email
        print("\n📧 Testing Call with Receiver Email...")
        self.test_create_call("receiver@example.com")
        
        # Print Results
        print("\n" + "=" * 60)
        print("📊 TEST RESULTS SUMMARY")
        print("=" * 60)
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {success_rate:.1f}%")
        
        # Show failed tests
        failed_tests = [test for test in self.test_results if test['status'] == 'FAIL']
        if failed_tests:
            print(f"\n❌ FAILED TESTS ({len(failed_tests)}):")
            for test in failed_tests:
                print(f"  • {test['test']}: {test['details']}")
        
        print("\n" + "=" * 60)
        return success_rate >= 80  # Consider 80%+ success rate as passing

def main():
    """Main test execution"""
    tester = VoiceMirrorAPITester()
    
    try:
        success = tester.run_comprehensive_test()
        return 0 if success else 1
    except Exception as e:
        print(f"❌ Test suite failed with error: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())