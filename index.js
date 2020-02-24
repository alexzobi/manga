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

    console.log(chapterList)
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
    console.log('ALEXDEBUG: end', result)
  })
  .catch(err => {
    //handle error

    console.log("ALEXDEBUG: error", err)
  });