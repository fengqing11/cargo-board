const res = await fetch('http://117.72.67.127:30080/wps/api/v3/ide/file/csDYhtk0UKaq/script/V2-3npmjOBLq53lBH7k3XW64z/sync_task', {
  method: 'POST',
  headers: {
    'AirScript-Token': '6fGqU99bv52z1X4GgGwyoV',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ Context: { argv: { store_name: 'TTS-烛照' } } }),
});
console.log(res.status, res.headers.get('content-type'));
const data = await res.json();
console.log(JSON.stringify(data, null, 2).slice(0, 5000));
