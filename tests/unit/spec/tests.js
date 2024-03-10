/**
 * tests.js : Unit tests implemented with qunit
 *
 * Copyright 2013-2014 Mossroy and contributors
 * License GPL v3:
 *
 * This file is part of Kiwix.
 *
 * Kiwix is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Kiwix is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Kiwix (file LICENSE-GPLv3.txt).  If not, see <http://www.gnu.org/licenses/>
 */

/* global QUnit, Promise */

// import '../www/js/lib/promisePolyfill.js';
// import '../www/js/lib/arrayFromPolyfill.js';
import '../js/init.js';
// import '../www/js/app.js';
import zimArchive from '../../../www/js/lib/zimArchive.js';
import zimDirEntry from '../../../www/js/lib/zimDirEntry.js';
import util from '../../../www/js/lib/util.js';
import uiUtil from '../../../www/js/lib/uiUtil.js';
import utf8 from '../../../www/js/lib/utf8.js';
import { assert } from 'chai';

var localZimArchive;

/**
 * Make an HTTP request for a Blob and return a Promise
 *
 * @param {String} url URL to download from
 * @param {String} name Name to give to the Blob instance
 * @returns {Promise<Blob>} A Promise for the Blob
 */
function makeBlobRequest (url, name) {
    return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.onreadystatechange = function () {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 0) {
                    var blob = new Blob([xhr.response], { type: 'application/octet-stream' });
                    blob.name = name;
                    resolve(blob);
                } else {
                    console.error('Error reading file ' + url + ' status:' + xhr.status + ', statusText:' + xhr.statusText);
                    reject(new Error({
                        status: xhr.status,
                        statusText: xhr.statusText
                    }));
                }
            }
        };
        xhr.onerror = function () {
            console.error('Error reading file ' + url + ' status:' + xhr.status + ', statusText:' + xhr.statusText);
            reject(new Error({
                status: xhr.status,
                statusText: xhr.statusText
            }));
        };
        xhr.responseType = 'blob';
        xhr.send();
    });
}

// Let's try to download the ZIM files
var zimArchiveFiles = [];

var splitBlobs = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o'].map(function (c) {
    var filename = 'wikipedia_en_ray_charles_2015-06.zima' + c;
    return makeBlobRequest('tests/zims/legacy-ray-charles/' + filename, filename);
});
Promise.all(splitBlobs)
    .then(function (values) {
        zimArchiveFiles = values;
    }).then(function () {
        // Create a localZimArchive from selected files, in order to run the following tests
        localZimArchive = new zimArchive.ZIMArchive(zimArchiveFiles, null, function (zimArchive) {
            runTests();
        });
    });

var runTests = function () {
    describe('environment', function () {
        it('qunit test', function () {
            assert.equal('test', 'test', 'QUnit is properly configured');
        });

        it('check archive files are read', function () {
            assert.ok(zimArchiveFiles && zimArchiveFiles[0] && zimArchiveFiles[0].size > 0, 'ZIM file read and not empty');
        });
    });

    describe('utils', function () {
        describe('check reading an IEEE_754 float from 4 bytes', function () {
            it('the IEEE_754 float should be converted as -118.625', function () {
                const byteArray = new Uint8Array(4);
                byteArray[0] = 194;
                byteArray[1] = 237;
                byteArray[2] = 64;
                byteArray[3] = 0;
                const float = util.readFloatFrom4Bytes(byteArray, 0);
                assert.equal(float, -118.625);
            });
        });

        describe('check upper/lower case variations', function () {
            it('The first letter should be uppercase', function () {
                const testString1 = 'téléphone';
                const result = util.allCaseFirstLetters(testString1);
                assert.ok(result.indexOf('Téléphone') >= 0);
            });

            it('The first letter should be lowercase', function () {
                const testString2 = 'Paris';
                const result = util.allCaseFirstLetters(testString2);
                assert.ok(result.indexOf('paris') >= 0);
            });

            it('The first letter of every word should be uppercase', function () {
                const testString3 = 'le Couvre-chef Est sur le porte-manteaux';
                const result = util.allCaseFirstLetters(testString3);
                assert.ok(result.indexOf('Le Couvre-Chef Est Sur Le Porte-Manteaux') >= 0);
            });

            it('The first letter should be uppercase (with accent)', function () {
                const testString4 = 'épée';
                const result = util.allCaseFirstLetters(testString4);
                assert.ok(result.indexOf('Épée') >= 0);
            });

            it('First non-punctuation/non-currency Unicode letter should be uppercase, second (with breath mark) lowercase', function () {
                const testString5 = '$￥€“«xριστός» †¡Ἀνέστη!”';
                const result = util.allCaseFirstLetters(testString5);
                assert.ok(result.indexOf('$￥€“«Xριστός» †¡ἀνέστη!”') >= 0);
            });

            it('All Unicode letters should be uppercase', function () {
                const testString6 = 'Καλά Νερά Μαγνησία žižek';
                const result = util.allCaseFirstLetters(testString6, 'full');
                assert.ok(result.indexOf('ΚΑΛΆ ΝΕΡΆ ΜΑΓΝΗΣΊΑ ŽIŽEK') >= 0);
            });
        });

        describe('check removal of parameters in URL', function () {
            it('should remove parameters in URL and match base URL', function () {
                const baseUrl = "A/Che cosa è l'amore?.html";
                const testUrls = [
                    "A/Che%20cosa%20%C3%A8%20l'amore%3F.html?param1=toto&param2=titi",
                    "A/Che%20cosa%20%C3%A8%20l'amore%3F.html?param1=toto&param2=titi#anchor",
                    "A/Che%20cosa%20%C3%A8%20l'amore%3F.html#anchor"
                ];
                testUrls.forEach(function (testUrl) {
                    assert.equal(decodeURIComponent(
                        uiUtil.removeUrlParameters(testUrl)
                    ), baseUrl);
                });
            });
        });
    });

    describe('ZIM initialisation', function () {
        it('ZIM archive is ready', function () {
            assert.strictEqual(localZimArchive.isReady(), true, 'ZIM archive should be set as ready');
        });
    });

    describe('ZIM metadata', function () {
        it('read ZIM language', function (done) {
            assert.expect(1);
            const callbackFunction = function (language) {
                assert.strictEqual(language, 'eng', 'The language read inside the Metadata should be "eng" for "English"');
                done();
            };
            localZimArchive.getMetadata('Language', callbackFunction);
        });

        it('try to read a missing metadata', function (done) {
            assert.expect(1);
            const callbackFunction = function (string) {
                assert.strictEqual(string, undefined, 'The metadata zzz should not be found inside the ZIM');
                done();
            };
            localZimArchive.getMetadata('zzz', callbackFunction);
        });
    });

    describe('zim_direntry_search_and_read', function () {
        it("check DirEntry.fromStringId 'A Fool for You'", function (done) {
            var aFoolForYouDirEntry = zimDirEntry.DirEntry.fromStringId(localZimArchive.file, '5856|7|A|0|2|A_Fool_for_You.html|A Fool for You|false|undefined');

            assert.expect(2);
            var callbackFunction = function (dirEntry, htmlArticle) {
                assert.ok(htmlArticle && htmlArticle.length > 0, 'Article not empty');
                // Remove new lines
                htmlArticle = htmlArticle.replace(/[\r\n]/g, ' ');
                assert.ok(htmlArticle.match('^.*<h1[^>]*>A Fool for You</h1>'), "'A Fool for You' title somewhere in the article");
                done();
            };
            localZimArchive.readUtf8File(aFoolForYouDirEntry, callbackFunction);
        });

        it("check findDirEntriesWithPrefix 'A'", function (done) {
            assert.expect(2);
            var callbackFunction = function (dirEntryList) {
                assert.ok(dirEntryList && dirEntryList.length === 5, 'Article list with 5 results');
                var firstDirEntry = dirEntryList[0];
                assert.equal(firstDirEntry.getTitleOrUrl(), 'A Fool for You', 'First result should be "A Fool for You"');
                done();
            };
            localZimArchive.findDirEntriesWithPrefix({ prefix: 'A', size: 5 }, callbackFunction, true);
        });

        it("check findDirEntriesWithPrefix 'a'", function (done) {
            assert.expect(2);
            var callbackFunction = function (dirEntryList) {
                assert.ok(dirEntryList && dirEntryList.length === 5, 'Article list with 5 results');
                var firstDirEntry = dirEntryList[0];
                assert.equal(firstDirEntry.getTitleOrUrl(), 'A Fool for You', 'First result should be "A Fool for You"');
                done();
            };
            localZimArchive.findDirEntriesWithPrefix({ prefix: 'a', size: 5 }, callbackFunction, true);
        });

        it("check findDirEntriesWithPrefix 'blues brothers'", function (done) {
            assert.expect(2);
            var callbackFunction = function (dirEntryList) {
                assert.ok(dirEntryList && dirEntryList.length === 3, 'Article list with 3 result');
                var firstDirEntry = dirEntryList[0];
                assert.equal(firstDirEntry.getTitleOrUrl(), 'Blues Brothers (film)', 'First result should be "Blues Brothers (film)"');
                done();
            };
            localZimArchive.findDirEntriesWithPrefix({ prefix: 'blues brothers', size: 5 }, callbackFunction, true);
        });

        it("article '(The Night Time Is) The Right Time' correctly redirects to 'Night Time Is the Right Time'", function (done) {
            assert.expect(6);
            localZimArchive.getDirEntryByPath('A/(The_Night_Time_Is)_The_Right_Time.html').then(function (dirEntry) {
                assert.ok(dirEntry !== null, 'DirEntry found');
                if (dirEntry !== null) {
                    assert.ok(dirEntry.isRedirect(), 'DirEntry is a redirect.');
                    assert.equal(dirEntry.getTitleOrUrl(), '(The Night Time Is) The Right Time', 'Correct redirect title name.');
                    localZimArchive.resolveRedirect(dirEntry, function (dirEntry) {
                        assert.ok(dirEntry !== null, 'DirEntry found');
                        assert.ok(!dirEntry.isRedirect(), 'DirEntry is not a redirect.');
                        assert.equal(dirEntry.getTitleOrUrl(), 'Night Time Is the Right Time', 'Correct redirected title name.');
                        done();
                    });
                } else {
                    done();
                }
            });
        });

        it("article 'Raelettes' correctly redirects to 'The Raelettes'", function (done) {
            assert.expect(6);
            localZimArchive.getDirEntryByPath('A/Raelettes.html').then(function (dirEntry) {
                assert.ok(dirEntry !== null, 'DirEntry found');
                if (dirEntry !== null) {
                    assert.ok(dirEntry.isRedirect(), 'DirEntry is a redirect.');
                    assert.equal(dirEntry.getTitleOrUrl(), 'Raelettes', 'Correct redirect title name.');
                    localZimArchive.resolveRedirect(dirEntry, function (dirEntry) {
                        assert.ok(dirEntry !== null, 'DirEntry found');
                        assert.ok(!dirEntry.isRedirect(), 'DirEntry is not a redirect.');
                        assert.equal(dirEntry.getTitleOrUrl(), 'The Raelettes', 'Correct redirected title name.');
                        done();
                    });
                } else {
                    done();
                }
            });
        });

        it("article 'Bein Green' correctly redirects to 'Bein' Green", function (done) {
            assert.expect(6);
            localZimArchive.getDirEntryByPath('A/Bein_Green.html').then(function (dirEntry) {
                assert.ok(dirEntry !== null, 'DirEntry found');
                if (dirEntry !== null) {
                    assert.ok(dirEntry.isRedirect(), 'DirEntry is a redirect.');
                    assert.equal(dirEntry.getTitleOrUrl(), 'Bein Green', 'Correct redirect title name.');
                    localZimArchive.resolveRedirect(dirEntry, function (dirEntry) {
                        assert.ok(dirEntry !== null, 'DirEntry found');
                        assert.ok(!dirEntry.isRedirect(), 'DirEntry is not a redirect.');
                        assert.equal(dirEntry.getTitleOrUrl(), "Bein' Green", 'Correct redirected title name.');
                        done();
                    });
                } else {
                    done();
                }
            });
        });

        it("article 'America, the Beautiful' correctly redirects to 'America the Beautiful'", function (done) {
            assert.expect(6);
            localZimArchive.getDirEntryByPath('A/America,_the_Beautiful.html').then(function (dirEntry) {
                assert.ok(dirEntry !== null, 'DirEntry found');
                if (dirEntry !== null) {
                    assert.ok(dirEntry.isRedirect(), 'DirEntry is a redirect.');
                    assert.equal(dirEntry.getTitleOrUrl(), 'America, the Beautiful', 'Correct redirect title name.');
                    localZimArchive.resolveRedirect(dirEntry, function (dirEntry) {
                        assert.ok(dirEntry !== null, 'DirEntry found');
                        assert.ok(!dirEntry.isRedirect(), 'DirEntry is not a redirect.');
                        assert.equal(dirEntry.getTitleOrUrl(), 'America the Beautiful', 'Correct redirected title name.');
                        done();
                    });
                } else {
                    done();
                }
            });
        });

        it("Image 'm/RayCharles_AManAndHisSoul.jpg' can be loaded", function (done) {
            assert.expect(5);
            localZimArchive.getDirEntryByPath('I/m/RayCharles_AManAndHisSoul.jpg').then(function (dirEntry) {
                assert.ok(dirEntry !== null, 'DirEntry found');
                if (dirEntry !== null) {
                    assert.equal(dirEntry.namespace + '/' + dirEntry.url, 'I/m/RayCharles_AManAndHisSoul.jpg', 'URL is correct.');
                    assert.equal(dirEntry.getMimetype(), 'image/jpeg', 'MIME type is correct.');
                    localZimArchive.readBinaryFile(dirEntry, function (title, data) {
                        assert.equal(data.length, 4951, 'Data length is correct.');
                        var beginning = new Uint8Array([255, 216, 255, 224, 0, 16, 74, 70,
                            73, 70, 0, 1, 1, 0, 0, 1]);
                        assert.equal(data.slice(0, beginning.length).toString(), beginning.toString(), 'Data beginning is correct.');
                        done();
                    });
                } else {
                    done();
                }
            });
        });

        it("Stylesheet '-/s/style.css' can be loaded", function (done) {
            assert.expect(5);
            localZimArchive.getDirEntryByPath('-/s/style.css').then(function (dirEntry) {
                assert.ok(dirEntry !== null, 'DirEntry found');
                if (dirEntry !== null) {
                    assert.equal(dirEntry.namespace + '/' + dirEntry.url, '-/s/style.css', 'URL is correct.');
                    assert.equal(dirEntry.getMimetype(), 'text/css', 'MIME type is correct.');
                    localZimArchive.readBinaryFile(dirEntry, function (dirEntry, data) {
                        assert.equal(data.length, 104495, 'Data length is correct.');
                        data = utf8.decode(data);
                        var beginning = '\n/* start http://en.wikipedia.org/w/load.php?debug=false&lang=en&modules=site&only=styles&skin=vector';
                        assert.equal(data.slice(0, beginning.length), beginning, 'Content starts correctly.');
                        done();
                    });
                } else {
                    done();
                }
            });
        });

        it("Javascript '-/j/local.js' can be loaded", function (done) {
            assert.expect(5);
            localZimArchive.getDirEntryByPath('-/j/local.js').then(function (dirEntry) {
                assert.ok(dirEntry !== null, 'DirEntry found');
                if (dirEntry !== null) {
                    assert.equal(dirEntry.namespace + '/' + dirEntry.url, '-/j/local.js', 'URL is correct.');
                    assert.equal(dirEntry.getMimetype(), 'application/javascript', 'MIME type is correct.');
                    localZimArchive.readBinaryFile(dirEntry, function (dirEntry, data) {
                        assert.equal(data.length, 41, 'Data length is correct.');
                        data = utf8.decode(data);
                        var beginning = 'console.log( "mw.loader';
                        assert.equal(data.slice(0, beginning.length), beginning, 'Content starts correctly.');
                        done();
                    });
                } else {
                    done();
                }
            });
        });
        it("Split article 'A/Ray_Charles.html' can be loaded", function (done) {
            assert.expect(7);
            localZimArchive.getDirEntryByPath('A/Ray_Charles.html').then(function (dirEntry) {
                assert.ok(dirEntry !== null, 'Title found');
                if (dirEntry !== null) {
                    assert.equal(dirEntry.namespace + '/' + dirEntry.url, 'A/Ray_Charles.html', 'URL is correct.');
                    assert.equal(dirEntry.getMimetype(), 'text/html', 'MIME type is correct.');
                    localZimArchive.readUtf8File(dirEntry, function (dirEntry2, data) {
                        assert.equal(dirEntry2.getTitleOrUrl(), 'Ray Charles', 'Title is correct.');
                        assert.equal(data.length, 157186, 'Data length is correct.');
                        assert.equal(data.indexOf('the only true genius in show business'), 5535, 'Specific substring at beginning found.');
                        assert.equal(data.indexOf('Random Access Memories'), 154107, 'Specific substring at end found.');
                        done();
                    });
                } else {
                    done();
                }
            });
        });
        it('check that a random article is found', function (done) {
            assert.expect(2);
            var callbackRandomArticleFound = function (dirEntry) {
                assert.ok(dirEntry !== null, 'One DirEntry should be found');
                assert.ok(dirEntry.getTitleOrUrl() !== null, 'The random DirEntry should have a title');
                done();
            };
            localZimArchive.getRandomDirEntry(callbackRandomArticleFound);
        });

        it('check that the main article is found', function (done) {
            assert.expect(2);
            var callbackMainPageArticleFound = function (dirEntry) {
                assert.ok(dirEntry !== null, 'Main DirEntry should be found');
                assert.equal(dirEntry.getTitleOrUrl(), 'Summary', 'The main DirEntry should be called Summary');
                done();
            };
            localZimArchive.getMainPageDirEntry(callbackMainPageArticleFound);
        });
    });
}
