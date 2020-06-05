'use strict';

const fs = require('fs');
const axios = require('axios');

module.exports = ({ url, dest, timeout = 0, ...options }) => new Promise((resolve, reject) => {

  if (timeout) {
    request.setTimeout(timeout);
  }

  return axios
    .get(url, { ...options, responseType: 'stream'})
    .then(res => res.data)
    .then(data => {
      data.pipe(fs.createWriteStream(dest)).once('close', () => resolve({ filename: dest }));
    })
    .catch(err => console.error('Request Error: ', err));
    // .get(url, options, (res) => {
    //   if (res.statusCode !== 200) {
    //     // Consume response data to free up memory
    //     res.resume();
    //     reject(new Error('Request Failed.\n' +
    //                      `Status Code: ${res.statusCode}`));

    //     return;
    //   }

    //   res.pipe(fs.createWriteStream(dest)).once('close', () => resolve({ filename: dest }));
    // })
    // .on('timeout', reject)
    // .on('error', reject);
});
