const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const {default: PQueue} = require('p-queue');


const manganeloDownload = require('./sites/manganelo');
const viewcomicsDownload = require('./sites/viewcomics');
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
*/

const getSiteName = (url) => {
  const regex = /^(https?:\/\/)?(www\.)?(?<site>\S+)\./;
  const site = url.match(regex);

  if (!site.groups || !site.groups.site) return '';

  return site.groups.site;
}

const selectSiteAndCollect = async () => {
  const url = process.argv[2];
  const site = getSiteName(url);
  let downloadFunc;

  switch (site) {
    case !site:
      console.error('You must give a url for this program to work!');

      break;

    case 'manganelo':
      downloadFunc = manganeloDownload;

      break;

    case 'viewcomics':
      downloadFunc = viewcomicsDownload;

      break;

    default:
      console.error('Downloader for this site not yet implemented');

      break;
  }

  if (downloadFunc) {
    let end;

    if (!argv.all) {
      end = argv.start;

      if (argv.start < argv.end) {
        end = argv.end;
      }
    }

    await downloadFunc(url, argv.start, end);
  }

  process.exit();
};

selectSiteAndCollect();
