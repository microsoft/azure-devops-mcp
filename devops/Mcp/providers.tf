# Configure provider features here
terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "3.95.0" # previous was: 3.83.0
    }
    azapi = {
      source = "Azure/azapi"
    }
  }
}

provider "azurerm" {
  subscription_id = var.azure_rm_subscription_id

  features {
    resource_group {
      prevent_deletion_if_contains_resources = true
    }
  }
}

provider "azapi" {
}
