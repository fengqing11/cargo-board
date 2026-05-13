const res = await fetch('https://www.kdocs.cn/api/v3/ide/file/csDYhtk0UKaq/script/V2-3npmjOBLq53lBH7k3XW64z/sync_task', {
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
