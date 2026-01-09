# Admin V2: Account & API Troubleshooting Report

This document details the technical issues encountered during the Admin V2 rollout and the corresponding solutions applied to restore full system functionality.

## 1. API Service Initialization Failure (SyntaxError)
### Issue
The `api` container failed to start, logging a `SyntaxError: (unicode error) 'utf-8' codec can't decode byte...`.

### Root Cause
The `backend/app/main.py` file contained corrupted Korean string literals within the boolean parsing helper functions. These characters were likely corrupted during an encoding mismatch, preventing the Python interpreter from parsing the file.

### Resolution
- **Sanitization**: A custom script was executed to strip invalid UTF-8 bytes from `main.py`.
- **ASCII Refactor**: Problematic boolean parsing values were temporarily refactored to use standard ASCII-based logic to ensure stable service initialization.
- **Image Rebuild**: The Docker image was rebuilt (`docker compose build api`) to synchronize the sanitized host file with the container environment.

---

## 2. Authentication Password Mismatch
### Issue
Admin users were unable to perform sensitive operations (e.g., saving user details), receiving `401 Unauthorized` errors despite entering the "correct" password.

### Root Cause
A discrepancy existed between the local development fallback and the containerized environment:
- **`config.py` Fallback**: Set to `admin1234`.
- **`docker-compose.yml` Environment**: Set to `admin123`.
- **Frontend Logic**: Stored input in `sessionStorage` without initial backend validation, leading to "false success" UI states followed by API failures.

### Resolution
- **Environment Alignment**: Both `backend/app/config.py` and `c:\Users\JAVIS\rmarh\docker-compose.yml` were updated to use **`admin1234`** as the unified default credential.
- **Backend Validation**: The login flow was enhanced to perform a strict backend check using the `x-admin-password` header before granting UI access.

---

## 3. Frontend Header Injection
### Issue
API proxies were failing to pass the required headers to the backend services.

### Resolution
- Verified and ensured that the `withIdempotency` helper accurately injects the `x-admin-password` header into all proxy and direct API requests.
- Confirmed that `frontend/next.config.js` properly rewrites and proxies these headers to the upstream FastAPI service.

---

## 4. Current Status
- **Authentication**: Verified stable using `admin1234`.
- **API Health**: Healthy and responsive.
- **Integrity**: `main.py` is sanitized and successfully compiled.
