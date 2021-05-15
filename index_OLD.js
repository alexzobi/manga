const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const {default: PQueue} = require('p-queue');


const download = require('./requestWrapper');
const archive = require('./archiver');

const argv = require('yargs')
  .usage('Usage: $0 <url> [options]')
  .command('url', 'the url of the manga chapterlist you\'d like to read from')
  .example('$0 http://www.mangareader.net/goblin-slayer -s 10 -e 20', 'get Goblin Slayer starting from chapter 10 and ending after chapter 20')
  .alias('s', 'start')
  .nargs('s', 1)
  .describe('s', 'Chapter in the given chapter list to start from. Defaults to 1.')
  .default('s', 1)
  .alias('e', 'end')
  .nargs('e', 1)
  .describe('e', 'Chapter in the given chapter list to end on. Defaults to start index.')
  .alias('a', 'all')
  .describe('a', 'Download all chapters from start index. Defaults to false.')
  .help('h')
  .alias('h', 'help')
  .epilog('copyright 2020')
  .argv;

/*
 *** NOTE: ***
 After running this file, the code might hang and not all images will be downloaded.
 I have a feeling this has to do with the websites preventing this sort of behavior.
 To handle this, just kill and re-run the script. The remaining images will automatically
 be downloaded.

 This file has only been tested with mangareader.net. other sites will require different
 scraping paths.
*/

const url = process.argv[2];
const comicName = url.split('/')[3];

if (!url){
  console.error('You must give a url for this program to work!');

  process.exit()
}

axios.get(url)
  .then(res => res.data)
  .then(html => {
    // this function is responsible for finding all of the links for the available
    // chapters on the home page of the manga

    const chapterList$ = cheerio.load(html);
    const chapterList = chapterList$('a')
      .filter((idx, elem) => {
        return elem.attribs.href.startsWith(comicName, 1);
      })
      .toArray()
      .map(elem => elem.attribs.href)

    const sortedChapters = Array.from(new Set(chapterList)).sort((a, b) => {
      const chapterANumber = +a.split('/')[2]
      const chapterBNumber = +b.split('/')[2]

      if (chapterANumber < chapterBNumber) return -1;

      return 1;
    });

    const startIndex = sortedChapters.findIndex(chapterUrl => chapterUrl.split('/')[2] === String(argv.start));
    const endIndex = argv.all
      ? sortedChapters.length
      : argv.end
        ? sortedChapters.findIndex(chapterUrl => chapterUrl.split('/')[2] === String(argv.end)) + 1
        : startIndex + 1

    const finalChapterList = sortedChapters.slice(startIndex, endIndex);

    if (finalChapterList.length) {
      console.log(`${finalChapterList.length} chapters found. Fetching image links...`)
    } else {
      console.error('No chapters found within specified range');

      process.exit()
    }

    return finalChapterList;
  })
  .then( async chapterList => {
    const promiseArray = chapterList.map( async (chapterA) => {
      // this function performs a fetch on each of the chapter links to collect
      // all image links available on the page for that specific chapter

      // *NOTE* adding '/1' to the end of the chapter url forces the scroll view
      // of the site instead of the single page view. this means all images are
      // loaded onto the page.
      let pageIdx = 1;
      const chapterImageLinks = new Set([]);

      while (true) {
        const chapterURL = `https://www.mangareader.net${chapterA}/${pageIdx}`;
        const chapterHTML = await axios.get(chapterURL);

        if (!chapterHTML.data) {
          console.error(`No chapter found at ${chapterURL}`);

          process.exit()
        }

        const chapter$ = cheerio.load(chapterHTML.data);
        const chapterImageLink = chapter$('img')
          .toArray()
          .filter(image => image.attribs.src.includes(chapterA))
          .map(image => `https:${image.attribs.src}`)
          [0]

        if (!chapterImageLink || chapterImageLinks.has(chapterImageLink)) break;

        chapterImageLinks.add(chapterImageLink);

        pageIdx++;
      }

      return Array.from(chapterImageLinks);
    })

    // Then we wait for all page links for chapter images to be collected then
    // return an object with the chapter list.
    const resolvedChapterImages = await Promise.all(promiseArray);

    console.log('Chapter image links gathered. Preparing to download...');

    return {
      chapterNameArray: chapterList,
      imageURLByChapterArray: resolvedChapterImages
    }
  })
  .then(async ({
    chapterNameArray,
    imageURLByChapterArray,
  }) => {
    // here we take all of the chapter names and the images by chapter and
    // download the files. The chapters are put into a promise queue with a
    // concurrancy of one chapter at a time because having too many simultaneous
    // downloads was causing images to not be fully downloaded and preventing all
    // promises from resolving causing the code to lock up.

    const imageDirectoryName = path.join(
      __dirname,
      'series',
      comicName,
      'images',
    );

    const chapterQueue = new PQueue({concurrency: 1});

    imageURLByChapterArray.forEach((chapter, chapterIdx) => {
      chapterQueue.add(async () => {
        const chapterNumber = chapterNameArray[chapterIdx].split('/').pop()

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
              url: imageURL,
              dest, // Save to /path/to/dest/photo
              extractFilename: false
            };

            try {
              const downloadRes = await download(options);
              const { filename } = downloadRes;
            } catch (err) {
              console.error(`ALEXDEBUG: ${options.url} download error`,err)
            }
          }
        }))

        console.log(`Chapter ${chapterNumber} downloaded. ${chapterQueue.size} remaining...`)
      })
    })

    await chapterQueue.onIdle();

    return {
      imageDirectoryName,
      chapterStart: argv.start,
      chapterEnd: argv.end,
    };
  })
  .then(async ({ imageDirectoryName, chapterStart, chapterEnd }) => {
    // create the cbz file and then delete the original directory where images
    // are stored.
    console.log(`Finished downloading images. Creating archive file from ${imageDirectoryName}...`);

    await archive(comicName, imageDirectoryName, chapterStart, chapterEnd);

    console.log('Archive finished. Removing images...')

    fs.rmdirSync(imageDirectoryName, { recursive: true }, (err) => {
      if (err) {
          throw err;
      }
    });

    console.log(`${imageDirectoryName} deleted. \n\n Job complete.`);
  })
  .catch(err => {
    //handle error

    console.log("ALEXDEBUG: error", err)
  });