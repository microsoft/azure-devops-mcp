locals {
  project         = lower(var.project)
  resource_prefix = local.project
  application     = var.application #application will contain multiple projects (microservices)
  default_tags = {
    managed-by = "terraform"
  }
}
