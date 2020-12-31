const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const download = require('./requestWrapper');

const argv = require('yargs')
  .usage('Usage: $0 <url> [options]')
  .command('url', 'the url of the manga chapterlist you\'d like to read from')
  .example('$0 http://www.mangareader.net/goblin-slayer -s 10 -e 20', 'get Goblin Slayer starting from chapter 10 and ending after chapter 20')
  .alias('s', 'start')
  .nargs('s', 1)
  .describe('s', 'Chapter in the given chapter list to start from')
  .default('s', 1)
  .alias('e', 'end')
  .nargs('e', 1)
  .describe('e', 'Chapter in the given chapter list to end on')
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

if (!url){
  console.error('You must give a url for this program to work!');

  process.exit()
}

axios.get(url)
  .then(res => res.data)
  .then(html => {
    // this function is responsible for finding all of the links for the available
    // chapters on the home page of the manga

    const name = url.split('/')[3]
    const chapterList$ = cheerio.load(html);
    const chapterList = chapterList$('a')
      .filter((idx, elem) => {
        // console.log('ALEXDEBUG: elem', elem.attr('href'))

        return elem.attribs.href.startsWith(name, 1);
      })
      .toArray()
      .map(elem => elem.attribs.href)

    const sortedChapters = Array.from(new Set(chapterList)).sort((a, b) => {
      const chapterANumber = +a.split('/')[2]
      const chapterBNumber = +b.split('/')[2]

      if (chapterANumber < chapterBNumber) return -1;

      return 1;
    });



    console.log('ALEXDEBUG: sortedChapters', sortedChapters)

    const startIndex = sortedChapters.findIndex(chapterUrl => chapterUrl.split('/')[2] === String(argv.start))
    const endIndex = argv.end
      ? sortedChapters.findIndex(chapterUrl => chapterUrl.split('/')[2] === String(argv.end)) + 1
      : sortedChapters.length

    console.log('ALEXDEBUG: startIndex', startIndex);
    console.log('ALEXDEBUG: endIndex', endIndex);

    const finalChapterList = sortedChapters.slice(startIndex, endIndex);

    if (finalChapterList.length) {
      console.log(`${finalChapterList.length} chapters found. Fetching chapters...`)
    } else {
      console.error('No chapters found within specified range');

      process.exit()
    }

    console.log('ALEXDEBUG: finalChapterList', finalChapterList)

    return finalChapterList;
  })
  .then( chapterList => chapterList.map( async (chapterA) => {
    const chapterURL = `http://www.mangareader.net${chapterA}`;

    return axios.get(chapterURL)
      .then(res => res.data)
      .then(pageHTML => {
        const pageList$ = cheerio.load(pageHTML);
        const pageList = pageList$('#pageMenu')
          .find('option')
          .toArray()
          .map(option => option.attribs.value)

        return pageList;
      })
      .catch(err => {
        //handle error

        console.log("ALEXDEBUG: page collection error", err)
      });
  }))
  .then( async promiseArray => {
    const result = await Promise.all(promiseArray)

    return result;
  })
  .then(async pageAnchorByChapterArray => {
    const imageURLByChapterArray = [];
    const chapterNameArray = [];

    for(let i = 0; i < pageAnchorByChapterArray.length; i++){
      const pageAnchorArray = pageAnchorByChapterArray[i];
      const chapterName = pageAnchorByChapterArray[i][0];

      const pageImageMap = await Promise.all(pageAnchorArray.map(async pageAnchor => {
        const pageURL = `http://www.mangareader.net${pageAnchor}`;

        return axios.get(pageURL)
          .then(res => res.data)
          .then(pageHTML => {
            const imageURL$ = cheerio.load(pageHTML);
            const imageURL = imageURL$('#img')[0].attribs.src

            return imageURL;
          })
          .catch(err => {
            //handle error

            console.log("ALEXDEBUG: page collection error", err)
          });
      }));

      imageURLByChapterArray.push(pageImageMap);
      chapterNameArray.push(chapterName);
    }

    return {chapterNameArray, imageURLByChapterArray};
  })
  .then(async ({ chapterNameArray, imageURLByChapterArray}) => Promise.all([
    await imageURLByChapterArray.forEach(async (chapter, chapterIdx) => {
      const directory = `./series${chapterNameArray[chapterIdx]}`;
      const chapterNumber = chapterNameArray[chapterIdx].split('/').pop()

      await chapter.forEach(async (imageURL, imageIdx) => {
        const directoryExists = fs.existsSync(directory)

        if (!directoryExists) {
          fs.mkdirSync(directory, { recursive: true }, (err) => {
            // => [Error: EPERM: operation not permitted, mkdir 'C:\']
            if (err) throw err;
          });
        }

        const urlArray = imageURL.split('.');
        const filetype = urlArray[urlArray.length -1];
        const dest = `${directory}/${chapterNumber}_${imageIdx + 1}.${filetype}`

        if (!fs.existsSync(dest)){
          const options = {
            url: imageURL,
            dest, // Save to /path/to/dest/photo
            extractFilename: false
          }

          await download(options)
            .then(({ filename, image }) => {
              console.log('Saved to', filename) // Saved to /path/to/dest/photo
            })
            .catch((err) => console.error(`ALEXDEBUG: ${options.url} download error`,err))
        }
      })
    })
  ]))
  .catch(err => {
    //handle error

    console.log("ALEXDEBUG: error", err)
  });