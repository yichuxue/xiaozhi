const { WebSocketServer } = require('ws');
const config = require('./config');
const { OpusEncoder } = require('@discordjs/opus');
const AsrWorkerManager = require('./manager');

const wss = new WebSocketServer({ port: config.asrFrontendPort });
const manager = new AsrWorkerManager();
const decoder = new OpusEncoder(config.decodeSampleRate, 1);

wss.on('connection', (ws) => {
  const worker = manager.getWorker();
  if (!worker) {
    console.error('没有可用的ASR工作节点');
    ws.close();
    return;
  }

  worker.on('close', () => {
    ws.close();
  });

  const session = worker.newSession();
  session.on('text', (text, embedding, url) => {
    ws.send(JSON.stringify({ type: 'text', text, embedding, url }));
  });

  ws.on('message', (message, isBinary) => {
    if (isBinary) {
      session.sendAudio(decoder.decode(message));
    } else {
      const json = JSON.parse(message);
      if (json.type === 'detect') {
        session.detect(json.words);
      } else {
        console.error('收到未知消息类型:', json.type);
      }
    }
  });

  ws.on('close', () => {
    session.finish();
  });
});

wss.on('listening', () => {
  console.log('ASR前端服务器正在监听端口', wss.options.port);
});

