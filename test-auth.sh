#!/bin/bash

API_URL="http://113.170.158.188:8084/api"

echo "🧪 KIỂM TRA ĐĂNG KÝ/ĐĂNG NHẬP"
echo "================================"
echo ""

# Test 1: Đăng ký user mới
echo "✅ Test 1: Đăng ký user mới"
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "newuser",
    "email": "newuser@test.com",
    "password": "password123"
  }')

echo "Response: $REGISTER_RESPONSE"
echo ""

# Kiểm tra có token không
if echo "$REGISTER_RESPONSE" | grep -q "token"; then
  echo "✅ Đăng ký thành công - có token"
else
  echo "❌ Đăng ký thất bại - không có token"
fi
echo ""

# Test 2: Đăng ký với username đã tồn tại (phải lỗi)
echo "✅ Test 2: Đăng ký với username đã tồn tại (phải lỗi)"
DUPLICATE_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "manager",
    "email": "another@test.com",
    "password": "password123"
  }')

echo "Response: $DUPLICATE_RESPONSE"
if echo "$DUPLICATE_RESPONSE" | grep -q "error"; then
  echo "✅ Đúng - báo lỗi username đã tồn tại"
else
  echo "❌ Sai - không báo lỗi"
fi
echo ""

# Test 3: Đăng nhập với manager
echo "✅ Test 3: Đăng nhập với manager"
LOGIN_MANAGER=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "manager",
    "password": "manager123"
  }')

echo "Response: $LOGIN_MANAGER"
MANAGER_TOKEN=$(echo "$LOGIN_MANAGER" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$MANAGER_TOKEN" ]; then
  echo "✅ Đăng nhập thành công - Token: ${MANAGER_TOKEN:0:50}..."
  
  # Kiểm tra role
  if echo "$LOGIN_MANAGER" | grep -q "DATA_MANAGER"; then
    echo "✅ Role đúng: DATA_MANAGER"
  else
    echo "❌ Role sai"
  fi
else
  echo "❌ Đăng nhập thất bại"
fi
echo ""

# Test 4: Đăng nhập với user
echo "✅ Test 4: Đăng nhập với user"
LOGIN_USER=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "user",
    "password": "user123"
  }')

echo "Response: $LOGIN_USER"
USER_TOKEN=$(echo "$LOGIN_USER" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$USER_TOKEN" ]; then
  echo "✅ Đăng nhập thành công - Token: ${USER_TOKEN:0:50}..."
  
  # Kiểm tra role
  if echo "$LOGIN_USER" | grep -q '"role":"USER"'; then
    echo "✅ Role đúng: USER"
  else
    echo "❌ Role sai"
  fi
else
  echo "❌ Đăng nhập thất bại"
fi
echo ""

# Test 5: Đăng nhập sai password
echo "✅ Test 5: Đăng nhập sai password (phải lỗi)"
WRONG_PASSWORD=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "manager",
    "password": "wrongpassword"
  }')

echo "Response: $WRONG_PASSWORD"
if echo "$WRONG_PASSWORD" | grep -q "error"; then
  echo "✅ Đúng - báo lỗi sai password"
else
  echo "❌ Sai - không báo lỗi"
fi
echo ""

# Test 6: Truy cập /api/data với token manager
echo "✅ Test 6: Truy cập /api/data với token manager"
if [ -n "$MANAGER_TOKEN" ]; then
  DATA_RESPONSE=$(curl -s "$API_URL/data" \
    -H "Authorization: Bearer $MANAGER_TOKEN")
  
  echo "Response: $DATA_RESPONSE"
  if echo "$DATA_RESPONSE" | grep -q "message"; then
    echo "✅ Truy cập thành công"
  else
    echo "❌ Truy cập thất bại"
  fi
else
  echo "⚠️ Không có token manager để test"
fi
echo ""

# Test 7: Truy cập /api/data với token user (phải bị chặn)
echo "✅ Test 7: Truy cập /api/data với token user (phải bị chặn)"
if [ -n "$USER_TOKEN" ]; then
  USER_DATA_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$API_URL/data" \
    -H "Authorization: Bearer $USER_TOKEN")
  
  HTTP_CODE=$(echo "$USER_DATA_RESPONSE" | grep "HTTP_CODE" | cut -d':' -f2)
  
  if [ "$HTTP_CODE" = "403" ]; then
    echo "✅ Đúng - bị chặn với HTTP 403"
  else
    echo "❌ Sai - không bị chặn (HTTP $HTTP_CODE)"
  fi
else
  echo "⚠️ Không có token user để test"
fi
echo ""

# Test 8: Validation - username quá ngắn
echo "✅ Test 8: Validation - username quá ngắn (phải lỗi)"
SHORT_USERNAME=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "ab",
    "email": "test@test.com",
    "password": "password123"
  }')

echo "Response: $SHORT_USERNAME"
if echo "$SHORT_USERNAME" | grep -q "error\|must be between"; then
  echo "✅ Đúng - báo lỗi username quá ngắn"
else
  echo "❌ Sai - không báo lỗi"
fi
echo ""

# Test 9: Validation - password quá ngắn
echo "✅ Test 9: Validation - password quá ngắn (phải lỗi)"
SHORT_PASSWORD=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser2",
    "email": "test2@test.com",
    "password": "12345"
  }')

echo "Response: $SHORT_PASSWORD"
if echo "$SHORT_PASSWORD" | grep -q "error\|at least 6"; then
  echo "✅ Đúng - báo lỗi password quá ngắn"
else
  echo "❌ Sai - không báo lỗi"
fi
echo ""

# Test 10: Validation - email không hợp lệ
echo "✅ Test 10: Validation - email không hợp lệ (phải lỗi)"
INVALID_EMAIL=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser3",
    "email": "invalid-email",
    "password": "password123"
  }')

echo "Response: $INVALID_EMAIL"
if echo "$INVALID_EMAIL" | grep -q "error\|valid"; then
  echo "✅ Đúng - báo lỗi email không hợp lệ"
else
  echo "❌ Sai - không báo lỗi"
fi
echo ""

echo "================================"
echo "🎯 HOÀN THÀNH KIỂM TRA"
