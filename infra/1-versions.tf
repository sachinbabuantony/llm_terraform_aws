#Terraform Block

terraform {

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
  backend "s3" {
    bucket         = "ttf-remote-backend-state-4286"
    key            = "dev/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-locks"
    encrypt        = true
  }

}

#Provider Block
provider "aws" {
  region  = var.aws_region
}


