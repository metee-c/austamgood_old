const http = require('http');

http.get('http://localhost:3000/api/system-users', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const result = JSON.parse(data);
    console.log('System Users:');
    if (result.data) {
      result.data.forEach(u => {
        console.log(`user_id: ${u.user_id}, username: ${u.username}, full_name: ${u.full_name}, employee_id: ${u.employee_id}`);
      });
    } else {
      console.log(result);
    }
  });
}).on('error', err => console.error('Error:', err));
