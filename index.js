const rp = require('request-promise');
const cheerio = require('cheerio');
const url = 'http://www.mangareader.net/goblin-slayer';

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
    const imageURLresult = [];
    for(let i = 0; i < 3; i++){
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

      imageURLresult.push(pageImageMap);
    }

    return imageURLresult;
  })
  .then(imageURLresult => console.log('ALEXDEBUG: imageResult', imageURLresult))
  .catch(err => {
    //handle error

    console.log("ALEXDEBUG: error", err)
  });