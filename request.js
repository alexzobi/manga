'use strict';

const fs = require('fs');
const axios = require('axios');

async function downloadImage ({ url, dest, ...options }) {
  const writer = fs.createWriteStream(dest)

  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
    ...options,
  });

  response.data.pipe(writer)

  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve({ filename: dest }))
    writer.on('error', reject)
  })
}

module.exports = downloadImage;
