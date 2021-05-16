const fs = require('fs');
const archive = require('./archiver');

const archiveImages = async (mangaTitle, imageDirectoryName, chapterStart, chapterEnd) => {
  // create the cbz file and then delete the original directory where images
  // are stored.
  console.log(`Finished downloading images. Creating archive file from ${imageDirectoryName}...`);

  await archive(mangaTitle, imageDirectoryName, chapterStart, chapterEnd);

  console.log('Archive finished. Removing images...')

  fs.rmdirSync(imageDirectoryName, { recursive: true }, (err) => {
    if (err) {
        throw err;
    }
  });

  console.log(`${imageDirectoryName} deleted. \n\n Job complete.`);
}

module.exports = archiveImages;