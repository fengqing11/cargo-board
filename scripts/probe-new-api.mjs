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
console.log(data.data.result.length);
console.log(Object.keys(data.data.result[0].fields));
console.log(data.data.result[0].fields['店铺'], data.data.result[0].fields['款号'], data.data.result[0].fields['类目']);
