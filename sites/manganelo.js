const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const {default: PQueue} = require('p-queue');

const download = require('../requestWrapper');
const archive = require('../archiver');

const getMangaTitle = async (url) => {
  const chapterListPage = await axios.get(url);

  if (!chapterListPage.data) {
    console.error('Chapter list page not found');

    return;
  }

  const chapterHtml = chapterListPage.data;

  const chapter$ = cheerio.load(chapterHtml);
  const titles = chapter$('h1')
  .toArray()
  .filter(header => {
    if (
      !header
      || typeof header !== 'object'
      || !header.parent
      || !header.parent.attribs
      || !header.parent.attribs.class
    ) return false;

    return header.parent.attribs.class.includes('story-info-right')
  })

  if (!titles.length) return 'title not found';

  return titles[0].children[0].data;
}

const collectChapterList = async (url, start, end) => {
  const chapterListPageRes = await axios.get(url);

  if (!chapterListPageRes.data) {
    console.error('Chapter list page not found');

    return;
  }

  const chapterListHtml = chapterListPageRes.data;

  const chapterList$ = cheerio.load(chapterListHtml);
  const chapterList = chapterList$('a')
    .filter((_, elem) => {
      if (
        !elem
        || !elem.attribs
        || !elem.attribs.class
      ) return false;

      if (elem.attribs.class.includes('chapter-name')) {
        const chapterNumber = +elem.attribs.href.split('/').pop().split('_')[1]

        if (
          chapterNumber >= start
          && (!end || chapterNumber <= end)
        ) {
          return true;
        }

        return false;
      }

      return false;
    })
    .toArray()
    .map(elem => elem.attribs.href)

  const sortedChapters = Array.from(new Set(chapterList)).sort((a, b) => {
    const chapterANumber = +a.split('/').pop().split('_')[1]
    const chapterBNumber = +b.split('/').pop().split('_')[1]

    if (chapterANumber < chapterBNumber) return -1;

    return 1;
  });

  return sortedChapters;
};

const collectChapterImageLinks = async (chapterUrl) => {
  const chapterRes = await axios.get(chapterUrl);

  if (!chapterRes.data) {
    console.error('Chapter list page not found');

    return;
  }

  const chapterHtml = chapterRes.data;

  const chapter$ = cheerio.load(chapterHtml);
  return chapter$('img')
  .toArray()
  .filter(image => {
    if (
      !image
      || typeof image !== 'object'
      || !image.parent
      || !image.parent.attribs
      || !image.parent.attribs.class
    ) return false;

    return image.parent.attribs.class.includes('container-chapter-reader')
  })
  .map(image => image.attribs.src)
}

const collectAllChapterImageLinks = async (chapterList) => {
  const chapterImageLinkPromises = chapterList.map(chapter => collectChapterImageLinks(chapter));

  return Promise.all(chapterImageLinkPromises);
}

const downloadChapterImages = async (mangaTitle, chapterList, imageURLByChapterArray) => {
  // here we take all of the chapter names and the images by chapter and
  // download the files. The chapters are put into a promise queue with a
  // concurrancy of one chapter at a time because having too many simultaneous
  // downloads was causing images to not be fully downloaded and preventing all
  // promises from resolving causing the code to lock up.

  const imageDirectoryName = path.join(
    __dirname,
    '..',
    'series',
    mangaTitle,
    'images',
  );

  const chapterQueue = new PQueue({concurrency: 1});

  imageURLByChapterArray.forEach((chapter, chapterIdx) => {
    chapterQueue.add(async () => {
      const chapterNumber = chapterList[chapterIdx].split('/').pop()

      await Promise.all(chapter.map(async (imageURL, imageIdx) => {
        const directoryExists = fs.existsSync(imageDirectoryName)

        if (!directoryExists) {
          fs.mkdirSync(imageDirectoryName, { recursive: true }, (err) => {
            // => [Error: EPERM: operation not permitted, mkdir 'C:\']
            console.log(`${imageDirectoryName} created`)

            if (err) throw err;
          });
        }

        const urlArray = imageURL.split('.');
        const filetype = urlArray[urlArray.length - 1];
        const dest = `${imageDirectoryName}/${chapterNumber}_${imageIdx + 1}.${filetype}`

        if (!fs.existsSync(dest)){
          const options = {
            headers: {
              authority: "s31.mkklcdnv6tempv2.com",
              method: "GET",
              scheme: "https",
              accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
              "accept-encoding": "gzip, deflate, br",
              "accept-language": "en-US,en;q=0.9",
              dnt: "1",
              referer: "https://manganelo.com/",
              "sec-ch-ua": "\" Not A;Brand\";v=\"99\", \"Chromium\";v=\"90\", \"Google Chrome\";v=\"90\"",
              "sec-ch-ua-mobile": "?0",
              "sec-fetch-dest": "image",
              "sec-fetch-mode": "no-cors",
              "sec-fetch-site": "cross-site",
              "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36",
            },
            url: imageURL,
            dest, // Save to /path/to/dest/photo
            extractFilename: false
          };

          try {
            const downloadRes = await download(options);
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

const selectChaptersAndDownload = async (url, start, end) => {
  const mangaTitle = await getMangaTitle(url);
  const chapterList = await collectChapterList(url, start, end);

  if (!chapterList) {
    console.log("No chapters found");

    return;
  }

  const chapterImageLinks = await collectAllChapterImageLinks(chapterList);
  const imageDirectoryName = await downloadChapterImages(mangaTitle, chapterList, chapterImageLinks);

  await archiveImages(mangaTitle, imageDirectoryName, start, end);
}

module.exports = selectChaptersAndDownload;
