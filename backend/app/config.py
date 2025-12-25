import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://vault:vaultpass@db:5432/vault")
APP_ENV = os.getenv("APP_ENV", "local")

# Admin access
# In prod/stage, ADMIN_PASSWORD must be set via env. For test/local, a fallback is allowed only if bypass is enabled.
ALLOW_INSECURE_ADMIN_BYPASS = os.getenv("ALLOW_INSECURE_ADMIN_BYPASS", "true").lower() == "true" if APP_ENV in {"test", "local"} else False
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")
if ADMIN_PASSWORD is None:
	if ALLOW_INSECURE_ADMIN_BYPASS:
		ADMIN_PASSWORD = "admin1234"
	else:
		raise RuntimeError("ADMIN_PASSWORD is required")

# Notification variants accepted (extend as needed)
ALLOWED_VARIANT_IDS = {"A", "B", "LOSS_BANNER_A", "LOSS_BANNER_B", "SOCIAL_PROOF_A", "SOCIAL_PROOF_B", "TICKET_ZERO_A", "TICKET_ZERO_B"}

# Notification types allowed
ALLOWED_NOTIFY_TYPES = {"EXPIRY_D2", "EXPIRY_D0", "ATTENDANCE_D2", "TICKET_ZERO", "SOCIAL_PROOF"}

# Admin job types allowed
ALLOWED_ADMIN_JOB_TYPES = {"EXTEND_EXPIRY", "BULK_UPDATE", "NOTIFY", "DAILY_IMPORT"}

# Idempotency TTL (hours)
IDEMPOTENCY_TTL_HOURS = int(os.getenv("IDEMPOTENCY_TTL_HOURS", "24"))

# Compensation retry policy
COMPENSATION_MAX_RETRIES = int(os.getenv("COMPENSATION_MAX_RETRIES", "5"))
COMPENSATION_BACKOFF_SECONDS = [1, 5, 30, 300, 900]

# Job / admin query timeouts (ms)
JOB_LOCK_TIMEOUT_MS = int(os.getenv("JOB_LOCK_TIMEOUT_MS", "2000"))
JOB_STATEMENT_TIMEOUT_MS = int(os.getenv("JOB_STATEMENT_TIMEOUT_MS", "20000"))
