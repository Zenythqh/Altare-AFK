const WebSocket = require('ws');
const axios = require('axios');

const WEBHOOK_URL = '<đã che>';
const WS_URL = 'wss://console.altr.cc/ws';
const HEADERS = {
  'User-Agent': '< your UserAgent >',
  'Cookie': 'flux.sid=<cookie>; connect.sid=<cookie>'
};

let latestData = null;
let lastSentTime = 0;
const TWO_HOURS = 2 * 60 * 60 * 1000;
const startTime = Date.now();

// ------------------ sendDiscordEmbed ------------------
async function sendDiscordEmbed(data, isError = false) {
  if (!WEBHOOK_URL) return;

  const minutesRunning = Math.floor((Date.now() - startTime) / 60000);
  let embed = isError
    ? {
        title: 'WebSocket Connection Lost',
        description: data,
        color: 0xff0000,
        timestamp: new Date().toISOString(),
        footer: { text: 'WebSocket Monitor' }
      }
    : {
        title: 'AFK State Update',
        color: 0xff69b4,
        fields: [
          { name: 'Coins Per Minute', value: `${data.coinsPerMinute}`, inline: false },
          { name: 'Multiplier', value: `${data.multiplier}x`, inline: false },
          { name: 'Thời gian chạy', value: `${minutesRunning} phút`, inline: false },
          { name: 'Total Coins', value: 'fetching...', inline: false }
        ],
        timestamp: new Date().toISOString()
      };

  try {
    const res = await axios.post(WEBHOOK_URL, { embeds: [embed] });
    lastSentTime = Date.now();

    if (!isError) {
      try {
        const coinRes = await axios.get('https://console.altr.cc/api/coins', { headers: HEADERS });
        const totalCoins = coinRes.data?.coins?.toFixed(2) || 'API error';

        embed.fields[3].value = totalCoins;

        const messageId = res.data.id;
        await axios.patch(`${WEBHOOK_URL}/messages/${messageId}`, { embeds: [embed] });
      } catch {
        console.warn('Coin fetch failed');
      }
    }
  } catch (err) {
    console.error('Error sending embed:', err.message);
  }
}

// ------------------ WebSocket ------------------
const ws = new WebSocket(WS_URL, { headers: HEADERS });

ws.on('open', () => {
  console.log('WebSocket connection established');
  lastSentTime = Date.now() - TWO_HOURS;
});

ws.on('message', (data) => {
  try {
    const parsed = JSON.parse(data.toString());
    if (parsed.type === 'afk_state') {
      latestData = parsed;
      checkAndSendData?.();
    }
  } catch {
    console.error('JSON parse error');
  }
});

ws.on('error', (err) => console.error('WebSocket error:', err.message));

ws.on('close', (code, reason) => console.log('WebSocket closed', { code, reason: reason.toString() }));

process.on('SIGINT', () => {
  ws.close();
  process.exit(0);
});

// ------------------ check & send ------------------
function checkAndSendData() {
  if (latestData && Date.now() - lastSentTime >= TWO_HOURS) {
    sendDiscordEmbed(latestData);
  }
}

setInterval(checkAndSendData, 60_000);

console.log('WebSocket client started');
