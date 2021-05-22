const axios = require('axios');
const cheerio = require('cheerio');
const downloadChapterImages = require('../downloadChapterImages');
const archiveImages = require('../archiveImages');

const getComicTitle = async (url) => {
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
      || !header.attribs
      || !header.attribs.class
    ) return false;

    return header.attribs.class.includes('title')
  })

  if (!titles.length) return 'title not found';

  const title =  titles[0].children[0].data;

  return title.replaceAll(/[(|)]/g, '').trim();
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

      if (elem.attribs.class.includes('ch-name')) {
        const chapterNumber = +elem.attribs.href.split('/').pop().split('-')[1]

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
    const chapterANumber = +a.split('/').pop().split('-')[1]
    const chapterBNumber = +b.split('/').pop().split('-')[1]

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

    return image.parent.attribs.class.includes('chapter-container')
  })
  .map(image => image.attribs.src)
}

const collectAllChapterImageLinks = async (chapterList) => {
  const chapterImageLinkPromises = chapterList.map(chapter => collectChapterImageLinks(`${chapter}/full`));

  return Promise.all(chapterImageLinkPromises);
}

const getChapterNumber = chapterUrl => chapterUrl
  .split('/')
  .pop()
  .split('-')
  .pop();

const getFileTypeFromImageUrl = () => 'jpeg';

const selectChaptersAndDownload = async (url, start, end) => {
  const comicTitle = await getComicTitle(url);
  const chapterList = await collectChapterList(url, start, end);

  if (!chapterList) {
    console.log("No chapters found");

    return;
  }

  const chapterImageLinks = await collectAllChapterImageLinks(chapterList);

  const imageDirectoryName = await downloadChapterImages(
    comicTitle,
    chapterList,
    chapterImageLinks,
    getChapterNumber,
    getFileTypeFromImageUrl,
  );

  await archiveImages(comicTitle, imageDirectoryName, start, end);
}

module.exports = selectChaptersAndDownload;
