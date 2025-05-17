#!/bin/bash

# ======= CONFIGURATION ========
REGION="us-east-1"
BUCKET_NAME="ttf-remote-backend-state-4286"
DYNAMO_TABLE="terraform-locks"
STATE_KEY="dev/terraform.tfstate"
# ==============================

echo "🔧 Creating S3 bucket: $BUCKET_NAME"
if [ "$REGION" = "us-east-1" ]; then
  aws s3api create-bucket \
    --bucket "$BUCKET_NAME" \
    --region "$REGION"
else
  aws s3api create-bucket \
    --bucket "$BUCKET_NAME" \
    --region "$REGION" \
    --create-bucket-configuration LocationConstraint="$REGION"
fi

# Wait until bucket is available
echo "⏳ Waiting for bucket to exist..."
until aws s3api head-bucket --bucket "$BUCKET_NAME" 2>/dev/null; do
  sleep 2
done

echo "🔐 Enabling encryption on bucket"
aws s3api put-bucket-encryption \
  --bucket "$BUCKET_NAME" \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

echo "📦 Enabling versioning on bucket"
aws s3api put-bucket-versioning \
  --bucket "$BUCKET_NAME" \
  --versioning-configuration Status=Enabled

echo "🗄️ Creating DynamoDB table: $DYNAMO_TABLE"
aws dynamodb create-table \
  --table-name "$DYNAMO_TABLE" \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST 2>/dev/null

echo "✅ Done! You can now use the following Terraform backend config:"
# cat <<EOF

# terraform {
#   backend "s3" {
#     bucket         = "$BUCKET_NAME"
#     key            = "$STATE_KEY"
#     region         = "$REGION"
#     dynamodb_table = "$DYNAMO_TABLE"
#     encrypt        = true
#   }
# }
# EOF
