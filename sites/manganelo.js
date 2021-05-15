const axios = require('axios');
const cheerio = require('cheerio');

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


const selectChaptersAndDownload = async (url, start, end) => {
  console.log('ALEXDEBUG: start', start)
  console.log('ALEXDEBUG: end', end)
  const chapterList = await collectChapterList(url, start, end);

  console.log('ALEXDEBUG: chapterList', chapterList);

  if (!chapterList) {
    console.log("No chapters found");

    return;
  }

  const chapterImageLinks = await collectChapterImageLinks(chapterList[0]);

  console.log('ALEXDEBUG: chapterImageLinks', chapterImageLinks)
}

module.exports = selectChaptersAndDownload;