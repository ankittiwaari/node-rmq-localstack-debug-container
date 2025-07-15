# Make & Upload Files API
This API endpoint triggers the creation of files and uploads them to an S3-compatible storage (e.g., AWS S3 or LocalStack S3).

---

## Application setup
Execute following in terminal
```bash
docker-compose up
```

## Endpoint
`POST /fs/make-and-upload-files`

**Base URL:**  
- Local: `http://localhost:3000`
---
## Request

### Headers

| Key            | Value               |
| -------------- | ------------------- |
| `Content-Type` | `application/json` |

### Body Parameters

| Field           | Type    | Required | Description                          |
| --------------- | ------- | -------- | ------------------------------------ |
| `fileCount`     | number  |  Yes   | Number of files to create            |
| `fileSize`      | number  |  Yes   | Size of each file in **MB**          |
| `s3Destination` | string  |  Yes   | Destination S3 path where files will be uploaded |

---

### Example Request

```bash
curl --location 'http://localhost:3000/fs/make-and-upload-files' \
--header 'Content-Type: application/json' \
--data '{
    "fileCount": 2,
    "fileSize": 20,
    "s3Destination": "/sample/path"
}'
```
### Example Response
```json
{
  "status": "success",
  "message": "2 files (20 MB each) created and uploaded to /sample/path"
}
```

