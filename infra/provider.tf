terraform {
  required_version = "1.0.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "3.57.0"
    }

    cloudinit = {
      source  = "hashicorp/cloudinit"
      version = "2.2.0"
    }
  }
}

provider "aws" {
  region = "eu-west-2"
}