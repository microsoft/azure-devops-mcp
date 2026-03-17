locals {
  project         = lower(var.project)
  resource_prefix = "${local.project}"
  default_tags    = {
    managed-by = "terraform"
  }
}
