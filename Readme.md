
# 🚀 LLM-on-AWS Project

This project deploys a backend application using GitHub Actions CI/CD pipelines, Docker, Kubernetes, and Terraform on AWS. The pipelines handle building, pushing, deploying, and destroying infrastructure and application resources automatically.

---

## 📁 Project Structure

```
project/
│
├── .github/workflows/          # GitHub Actions pipelines
│   ├── build_push.yml          # Builds & pushes Docker image
│   ├── k8s_deploy.yml          # Deploys app to Kubernetes
│   ├── terraform_deployment.yml# Provisions AWS infrastructure
│   └── terraform_destroy.yml   # Destroys AWS infrastructure
│
├── app/
│   ├── backend/                # Python Flask backend
│   │   ├── app.py              # Main application
│   │   └── config.py           # App config
│   └── Dockerfile              # Containerize app
│
├── infra/                      # Terraform code
│   ├── main.tf                 # Terraform resources
│   └── variables.tf            # Terraform variables
```

---

## 🔐 GitHub Secrets Used

| Secret Name               | Description                                 |
|--------------------------|---------------------------------------------|
| `AWS_ACCESS_KEY_ID`      | AWS access key to deploy infrastructure     |
| `AWS_SECRET_ACCESS_KEY`  | AWS secret access key                       |
| `AWS_REGION`             | AWS region (e.g. `us-east-1`)               |
| `ECR_REPOSITORY`         | Name of the ECR repository                  |
| `KUBE_CONFIG_DATA`       | Base64 encoded Kubeconfig for cluster auth  |

---

## ⚙️ CI/CD Pipelines Overview

### ✅ 1. `build_push.yml`
- Triggered on: Push to `main` branch.
- Action: Builds Docker image, logs into AWS ECR, and pushes the image.

### ✅ 2. `terraform_deployment.yml`
- Triggered when commit message starts with `terraform apply`
- Action: Initializes Terraform and applies AWS infrastructure.

### ✅ 3. `terraform_destroy.yml`
- Triggered when commit message starts with `terraform destroy`
- Action: Runs `terraform destroy` to clean up resources.

### ✅ 4. `k8s_deploy.yml`
- Triggered when commit message starts with `k8s deploy`
- Action: Applies Kubernetes manifests and deploys backend service.

---

## 💻 Running Locally

### Prerequisites:
- Docker
- Python 3
- AWS CLI (with configured credentials)
- Terraform
- kubectl

### 1. Build & Run Locally
```bash
cd app
docker build -t llm:v1 .
docker run -p 8080:8080 llm:v1
```

### 2. Deploy with Terraform
```bash
cd infra
terraform init
terraform apply -auto-approve
```

### 3. Deploy to Kubernetes
```bash
kubectl apply -f k8s/
```

---

## 🚀 GitHub Actions Usage

To trigger specific pipelines, use **commit messages**:

- `terraform apply`: Triggers infrastructure creation
- `terraform destroy`: Triggers infrastructure destruction
- `k8s deploy`: Triggers Kubernetes deployment

> 💡 These pipelines run only when pushed to the `main` branch.

---

## 🧼 Destroy Resources
```bash
cd infra
terraform destroy -auto-approve
```
---






