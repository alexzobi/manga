const rp = require('request-promise');
const cheerio = require('cheerio');
const download = require('image-downloader')
const fs = require('fs');

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

rp(url)
  .then(html => {
    const chapterList$ = cheerio.load(html);
    const chapterList = chapterList$('div #chapterlist > table > tbody > tr > td > a')
      .toArray()
      .map( a => a.attribs.href);

    return chapterList;
  })
  .then( chapterList => chapterList.map( async (chapterA) => {
    const chapterURL = `http://www.mangareader.net${chapterA}`;

    return rp(chapterURL)
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

        return rp(pageURL)
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

          await download.image(options)
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