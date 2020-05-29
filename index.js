const rp = require('request-promise');
const cheerio = require('cheerio');
const url = 'http://www.mangareader.net/goblin-slayer';
const download = require('image-downloader')
const fs = require('fs');

rp(url)
  .then(html => {
    //success!
    const chapterList$ = cheerio.load(html);
    const chapterList = chapterList$('div #chapterlist > table > tbody > tr > td > a')
      .toArray()
      .map( a => a.attribs.href);

    return chapterList;
  })
  .then( chapterList => chapterList.map( async (chapterA, idx) => {
    const chapterURL = `http://www.mangareader.net${chapterA}`;

    return rp(chapterURL)
      .then(pageHTML => {
        const pageList$ = cheerio.load(pageHTML);
        const pageList = pageList$('#pageMenu')
          .find('option')
          .toArray()
          .map(option => option.attribs.value)

        // console.log(`Chapter ${idx} pagelist`, pageList)
        return pageList;
      })
      .catch(err => {
        //handle error

        console.log("ALEXDEBUG: page collection error", err)
      });

    // return result
  }))
  .then( async promiseArray => {
    const result = await Promise.all(promiseArray)

    return result;
  })
  .then(async pageAnchorByChapterArray => {
    const imageURLByChapterArray = [];
    for(let i = 0; i < pageAnchorByChapterArray.length; i++){
      const pageAnchorArray = pageAnchorByChapterArray[i];

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
    }

    return imageURLByChapterArray;
  })
  .then(async imageURLByChapterArray => Promise.all([
    await imageURLByChapterArray.forEach(async (chapter, chapterIdx) => {
      await chapter.forEach(async (imageURL, imageIdx) => {
        const directory = `./goblinSlayer/Chapter_${chapterIdx + 1}`;

        const directoryExists = fs.existsSync(directory)

        if (!directoryExists) {
          fs.mkdirSync(directory, { recursive: true }, (err) => {
            // => [Error: EPERM: operation not permitted, mkdir 'C:\']
            if (err) throw err;
          });
        }


        const urlArray = imageURL.split('.');
        const filetype = urlArray[urlArray.length -1];
        const dest = `${directory}/${imageIdx + 1}.${filetype}`

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
            .catch((err) => console.error("ALEXDEBUG: image download error",err))
        }
      })
    })
  ]))
  .catch(err => {
    //handle error

    console.log("ALEXDEBUG: error", err)
  });