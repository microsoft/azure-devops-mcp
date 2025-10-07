// Script de test pour valider le serveur MCP en local
// Ce script simule un client MCP et interroge le serveur

import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

console.log('🚀 Démarrage du test du serveur MCP Azure DevOps...\n');

// Démarrer le serveur
const server = spawn('node', ['dist/index.js', 'nexusinno', '--authentication', 'interactive'], {
  cwd: process.cwd(),
  stdio: ['pipe', 'pipe', 'pipe']
});

let outputBuffer = '';
let errorBuffer = '';

server.stdout.on('data', (data) => {
  const text = data.toString();
  outputBuffer += text;
  console.log('📤 Serveur:', text);
});

server.stderr.on('data', (data) => {
  const text = data.toString();
  errorBuffer += text;
  console.error('⚠️  Erreur:', text);
});

server.on('error', (error) => {
  console.error('❌ Erreur de démarrage:', error);
  process.exit(1);
});

// Attendre que le serveur démarre
await setTimeout(2000);

console.log('\n📨 Envoi de la requête "initialize"...\n');

// Envoyer une requête initialize (protocole MCP)
const initRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {
      roots: { listChanged: true },
      sampling: {}
    },
    clientInfo: {
      name: 'test-client',
      version: '1.0.0'
    }
  }
};

server.stdin.write(JSON.stringify(initRequest) + '\n');

// Attendre la réponse
await setTimeout(3000);

console.log('\n📨 Envoi de la requête "tools/list"...\n');

// Demander la liste des tools
const toolsRequest = {
  jsonrpc: '2.0',
  id: 2,
  method: 'tools/list',
  params: {}
};

server.stdin.write(JSON.stringify(toolsRequest) + '\n');

// Attendre la réponse
await setTimeout(3000);

console.log('\n📨 Envoi de la requête "prompts/list"...\n');

// Demander la liste des prompts
const promptsRequest = {
  jsonrpc: '2.0',
  id: 3,
  method: 'prompts/list',
  params: {}
};

server.stdin.write(JSON.stringify(promptsRequest) + '\n');

// Attendre la réponse
await setTimeout(3000);

// Terminer le serveur proprement
console.log('\n🛑 Arrêt du serveur...\n');
server.stdin.end();
server.kill();

await setTimeout(1000);

console.log('✅ Test terminé !');
console.log('\n📊 Résumé:');
console.log(`- Sortie reçue: ${outputBuffer.length} caractères`);
console.log(`- Erreurs: ${errorBuffer.length > 0 ? 'Oui' : 'Non'}`);

if (outputBuffer.length > 0) {
  console.log('\n📋 Réponses du serveur:');
  console.log(outputBuffer);
}

process.exit(0);
