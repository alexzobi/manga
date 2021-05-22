const fs = require('fs');
const path = require('path');
const {default: PQueue} = require('p-queue');
const download = require('./requestWrapper');

const downloadChapterImages = async (
  mangaTitle,
  chapterList,
  imageURLByChapterArray,
  getChapterNumber,
  getFileTypeFromImageUrl,
  siteSpecificOptions,
) => {
  // here we take all of the chapter names and the images by chapter and
  // download the files. The chapters are put into a promise queue with a
  // concurrancy of one chapter at a time because having too many simultaneous
  // downloads was causing images to not be fully downloaded and preventing all
  // promises from resolving causing the code to lock up.

  const imageDirectoryName = path.join(
    __dirname,
    'series',
    mangaTitle,
    'images',
  );

  const chapterQueue = new PQueue({concurrency: 1});

  imageURLByChapterArray.forEach((chapter, chapterIdx) => {
    chapterQueue.add(async () => {
      const chapterNumber = getChapterNumber(chapterList[chapterIdx]);

      await Promise.all(chapter.map(async (imageURL, imageIdx) => {
        const directoryExists = fs.existsSync(imageDirectoryName)

        if (!directoryExists) {
          fs.mkdirSync(imageDirectoryName, { recursive: true }, (err) => {
            // => [Error: EPERM: operation not permitted, mkdir 'C:\']
            console.log(`${imageDirectoryName} created`)

            if (err) throw err;
          });
        }

        const filetype = getFileTypeFromImageUrl(imageURL);
        const dest = `${imageDirectoryName}/${chapterNumber}_${imageIdx + 1}.${filetype}`

        if (!fs.existsSync(dest)){
          const options = {
            ...siteSpecificOptions,
            url: imageURL,
            dest, // Save to /path/to/dest/photo
            extractFilename: false
          };

          try {
            await download(options);
          } catch (err) {
            console.error(`ALEXDEBUG: ${options.url} download error`,err)
          }
        }
      }))

      console.log(`Chapter ${chapterNumber} downloaded. ${chapterQueue.size} remaining...`)
    })
  })

  await chapterQueue.onIdle();

  return imageDirectoryName;
}

module.exports = downloadChapterImages;