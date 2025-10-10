# Docker Commands Reference - Azure DevOps MCP Server

Quick reference for Docker commands used with the Azure DevOps MCP Server.

---

## 🏗️ Building the Image

### Standard Build

```bash
docker build -t azure-devops-mcp:latest .
```

### Build with Version Tag

```bash
docker build -t azure-devops-mcp:latest -t azure-devops-mcp:2.2.0 .
```

### Build without Cache (force rebuild)

```bash
docker build --no-cache -t azure-devops-mcp:latest .
```

---

## 🚀 Running the Container

### Basic Run (Development)

```bash
docker run -d \
  --name azure-devops-mcp-server \
  -p 3000:3000 \
  -e MCP_TRANSPORT=http \
  -e PORT=3000 \
  azure-devops-mcp:latest
```

### Run with Azure DevOps PAT

```bash
docker run -d \
  --name azure-devops-mcp-server \
  -p 3000:3000 \
  -e MCP_TRANSPORT=http \
  -e PORT=3000 \
  -e AZURE_DEVOPS_EXT_PAT=your_pat_token_here \
  azure-devops-mcp:latest
```

### Run in Foreground (see logs immediately)

```bash
docker run --rm \
  --name azure-devops-mcp-server \
  -p 3000:3000 \
  -e MCP_TRANSPORT=http \
  -e PORT=3000 \
  azure-devops-mcp:latest
```

---

## 📊 Monitoring & Inspection

### Check Container Status

```bash
docker ps --filter "name=azure-devops-mcp-server"
```

### View Container Logs

```bash
# All logs
docker logs azure-devops-mcp-server

# Follow logs (real-time)
docker logs -f azure-devops-mcp-server

# Last 50 lines
docker logs --tail 50 azure-devops-mcp-server

# With timestamps
docker logs -t azure-devops-mcp-server
```

### Inspect Container

```bash
# Full details
docker inspect azure-devops-mcp-server

# Health check status
docker inspect azure-devops-mcp-server | grep -A10 Health

# Environment variables
docker inspect azure-devops-mcp-server | grep -A20 Env

# Network settings
docker inspect azure-devops-mcp-server | grep -A10 NetworkSettings
```

### Container Resource Usage

```bash
# Real-time stats
docker stats azure-devops-mcp-server

# One-time stats
docker stats --no-stream azure-devops-mcp-server
```

---

## 🧪 Testing

### Run Test Script

```bash
# PowerShell
.\test-docker-container.ps1

# Or manually test endpoints
curl http://localhost:3000/health
curl http://localhost:3000/mcp/discovery
```

### Execute Command in Running Container

```bash
# Interactive shell
docker exec -it azure-devops-mcp-server sh

# Run a single command
docker exec azure-devops-mcp-server node --version
docker exec azure-devops-mcp-server npm list --depth=0
```

---

## 🛑 Stopping & Cleaning Up

### Stop Container

```bash
docker stop azure-devops-mcp-server
```

### Remove Container

```bash
docker rm azure-devops-mcp-server
```

### Stop and Remove in One Command

```bash
docker rm -f azure-devops-mcp-server
```

### Remove All Stopped Containers

```bash
docker container prune
```

---

## 🗑️ Image Management

### List Images

```bash
# All images
docker images

# Only azure-devops-mcp images
docker images azure-devops-mcp
```

### Remove Image

```bash
docker rmi azure-devops-mcp:latest
```

### Remove All Unused Images

```bash
docker image prune -a
```

### View Image Layers

```bash
docker history azure-devops-mcp:latest
```

### Image Size Details

```bash
docker images azure-devops-mcp --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
```

---

## 🏷️ Tagging for Azure Container Registry

### Tag for ACR

```bash
# Replace with your ACR name
docker tag azure-devops-mcp:latest acrmcpdevops.azurecr.io/mcp-devops:v1
docker tag azure-devops-mcp:latest acrmcpdevops.azurecr.io/mcp-devops:latest
```

### Push to ACR

```bash
# Login to ACR
az acr login --name acrmcpdevops

# Push image
docker push acrmcpdevops.azurecr.io/mcp-devops:v1
docker push acrmcpdevops.azurecr.io/mcp-devops:latest
```

---

## 🔍 Troubleshooting

### Container Won't Start

```bash
# Check if container exists
docker ps -a --filter "name=azure-devops-mcp-server"

# View exit logs
docker logs azure-devops-mcp-server

# Remove and try again
docker rm -f azure-devops-mcp-server
docker run -d --name azure-devops-mcp-server -p 3000:3000 azure-devops-mcp:latest
```

### Port Already in Use

```bash
# Find process using port 3000 (Windows PowerShell)
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess

# Use different port
docker run -d --name azure-devops-mcp-server -p 3001:3000 azure-devops-mcp:latest
```

### Health Check Failing

```bash
# Check health status
docker inspect --format='{{json .State.Health}}' azure-devops-mcp-server | jq

# Manual health check
curl http://localhost:3000/health
```

### Container Running but Not Responding

```bash
# Check if process is running inside container
docker exec azure-devops-mcp-server ps aux

# Check if port is exposed
docker port azure-devops-mcp-server

# Test from inside container
docker exec azure-devops-mcp-server wget -O- http://localhost:3000/health
```

---

## 📦 Export/Import Images

### Save Image to File

```bash
docker save azure-devops-mcp:latest -o azure-devops-mcp.tar
```

### Load Image from File

```bash
docker load -i azure-devops-mcp.tar
```

### Export Container to File

```bash
docker export azure-devops-mcp-server -o azure-devops-mcp-container.tar
```

---

## 🎯 Production Recommendations

### Run with Restart Policy

```bash
docker run -d \
  --name azure-devops-mcp-server \
  --restart unless-stopped \
  -p 3000:3000 \
  -e MCP_TRANSPORT=http \
  -e PORT=3000 \
  azure-devops-mcp:latest
```

### Run with Resource Limits

```bash
docker run -d \
  --name azure-devops-mcp-server \
  --memory="512m" \
  --cpus="1.0" \
  -p 3000:3000 \
  -e MCP_TRANSPORT=http \
  -e PORT=3000 \
  azure-devops-mcp:latest
```

### Run with Custom Network

```bash
# Create network
docker network create mcp-network

# Run container in network
docker run -d \
  --name azure-devops-mcp-server \
  --network mcp-network \
  -p 3000:3000 \
  -e MCP_TRANSPORT=http \
  -e PORT=3000 \
  azure-devops-mcp:latest
```

---

## 🔐 Environment Variables Reference

| Variable               | Default      | Description                        |
| ---------------------- | ------------ | ---------------------------------- |
| `MCP_TRANSPORT`        | `http`       | Transport mode (http or stdio)     |
| `PORT`                 | `3000`       | HTTP server port                   |
| `NODE_ENV`             | `production` | Node.js environment                |
| `AZURE_DEVOPS_EXT_PAT` | -            | Azure DevOps Personal Access Token |
| `AZURE_TENANT_ID`      | -            | Azure AD Tenant ID                 |
| `AZURE_CLIENT_ID`      | -            | Azure AD Application Client ID     |
| `AZURE_CLIENT_SECRET`  | -            | Azure AD Application Client Secret |

---

## 📚 Additional Resources

- **Phase 2 Documentation**: See [PHASE2_COMPLETE.md](./PHASE2_COMPLETE.md)
- **Deployment Plan**: See [PLAN_AZURE_DEPLOYMENT.md](./PLAN_AZURE_DEPLOYMENT.md)
- **Progress Tracking**: See [PHASES_PROGRESS.md](./PHASES_PROGRESS.md)
- **Docker Documentation**: https://docs.docker.com/
- **Azure Container Apps**: https://learn.microsoft.com/en-us/azure/container-apps/

---

**Last Updated**: October 10, 2025  
**Phase**: 2 (Containerization) - ✅ Complete
