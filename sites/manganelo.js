const axios = require('axios');
const cheerio = require('cheerio');
const downloadChapterImages = require('../downloadChapterImages');
const archiveImages = require('../archiveImages');

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

const selectChaptersAndDownload = async (url, start, end) => {
  const mangaTitle = await getMangaTitle(url);
  const chapterList = await collectChapterList(url, start, end);

  if (!chapterList) {
    console.log("No chapters found");

    return;
  }

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
  };

  const chapterImageLinks = await collectAllChapterImageLinks(chapterList);
  const imageDirectoryName = await downloadChapterImages(mangaTitle, chapterList, chapterImageLinks, options);

  await archiveImages(mangaTitle, imageDirectoryName, start, end);
}

module.exports = selectChaptersAndDownload;
