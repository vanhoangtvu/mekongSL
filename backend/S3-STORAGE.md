# 🗄️ S3 Storage Configuration

## 📋 Thông tin kết nối

- **Endpoint**: https://backup.hci.vn
- **Bucket**: c01-mekong-prod-01
- **User**: mekong
- **Quota**: 1TiB
- **Role**: owner
- **Access Key**: <your-access-key>
- **Secret Key**: <your-secret-key>
- **Versioning**: Mode Compliance 7 days

## 🚀 API Endpoints

### 1. Upload File
```bash
POST /api/s3/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

# Example
curl -X POST http://14.183.200.227:8084/api/s3/upload \
  -H "Authorization: Bearer <manager_token>" \
  -F "file=@/path/to/file.pdf"

# Upload với key tùy chỉnh
curl -X POST http://14.183.200.227:8084/api/s3/upload \
  -H "Authorization: Bearer <manager_token>" \
  -F "key=uploads/manual/file.pdf" \
  -F "file=@/path/to/file.pdf"

# Response
{
  "key": "uploads/manual/file.pdf",
  "url": "https://backup.hci.vn/c01-mekong-prod-01/uploads/manual/file.pdf",
  "message": "File uploaded successfully"
}
```

### 2. Download File
```bash
GET /api/s3/download/{key}
Authorization: Bearer <token>

# Example
curl -X GET http://14.183.200.227:8084/api/s3/download/uploads/20260525_183000_file.pdf \
  -H "Authorization: Bearer <manager_token>" \
  -o downloaded_file.pdf
```

### 3. List Files
```bash
GET /api/s3/list?prefix=uploads/
Authorization: Bearer <token>

# Example
curl -X GET http://14.183.200.227:8084/api/s3/list?prefix=uploads/ \
  -H "Authorization: Bearer <manager_token>"

# Response
{
  "files": [
    {
      "key": "uploads/20260525_183000_file1.pdf",
      "size": 12345,
      "lastModified": "2026-05-25T10:30:00Z"
    }
  ],
  "count": 1
}
```

### 4. Delete File
```bash
DELETE /api/s3/delete/{key}
Authorization: Bearer <token>

# Example
curl -X DELETE http://14.183.200.227:8084/api/s3/delete/uploads/20260525_183000_file.pdf \
  -H "Authorization: Bearer <manager_token>"

# Response
{
  "message": "File deleted successfully"
}
```

### 5. Check File Exists
```bash
GET /api/s3/exists/{key}
Authorization: Bearer <token>

# Example
curl -X GET http://14.183.200.227:8084/api/s3/exists/uploads/20260525_183000_file.pdf \
  -H "Authorization: Bearer <manager_token>"

# Response
{
  "exists": true
}
```

### 6. Current user / admin endpoints
```bash
GET /api/account/me
GET /api/admin/users
POST /api/admin/users
PUT /api/admin/users/{id}
DELETE /api/admin/users/{id}
```

## 🔒 Bảo mật

- Tất cả endpoints yêu cầu **DATA_MANAGER** role
- `/api/admin/users` yêu cầu **ADMIN** role
- Access key và secret key được lưu trong `application.yaml`
- **Production**: Nên dùng environment variables thay vì hardcode

## 📝 Sử dụng trong code

### Upload file
```java
@Autowired
private S3Service s3Service;

public void uploadFile(MultipartFile file) {
    String key = s3Service.uploadFile(file);
    String url = s3Service.getFileUrl(key);
    System.out.println("File uploaded: " + url);
}
```

### Download file
```java
InputStream inputStream = s3Service.downloadFile("uploads/file.pdf");
// Process inputStream
```

### List files
```java
List<String> files = s3Service.listFiles("uploads/");
files.forEach(System.out::println);
```

## 🧪 Test kết nối

```bash
# 1. Login để lấy token
TOKEN=$(curl -s -X POST http://14.183.200.227:8084/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"manager","password":"manager123"}' | jq -r '.token')

# 2. Test upload
echo "Test file content" > test.txt
curl -X POST http://14.183.200.227:8084/api/s3/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test.txt"

# 3. Test list
curl -X GET http://14.183.200.227:8084/api/s3/list \
  -H "Authorization: Bearer $TOKEN"
```

## ⚙️ Configuration

File: `backend/src/main/resources/application.yaml`

```yaml
s3:
  endpoint: https://backup.hci.vn
  bucket: c01-mekong-prod-01
  access-key: ${S3_ACCESS_KEY}
  secret-key: ${S3_SECRET_KEY}
  region: us-east-1
```

## 📦 Dependencies

```xml
<dependency>
    <groupId>software.amazon.awssdk</groupId>
    <artifactId>s3</artifactId>
    <version>2.20.26</version>
</dependency>
```

## 🔄 Object Locking

- **Mode**: Compliance
- **Duration**: 7 days
- Files không thể xóa trong vòng 7 ngày sau khi upload
- Phù hợp cho backup và compliance requirements
