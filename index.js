const path = require('path');

const noop = ()=>{};

/**
 * Request single file.
 * @param src
 * @param type
 * @param onSuccess
 * @param onError
 */
function request(src,type,onSuccess,onError){
    const request_ = new XMLHttpRequest();
    request_.open('GET',src);
    request_.repsonseType = type;
    request_.addEventListener('readystatechange',function onChange(){
        if(this.readyState === 4){
            switch(this.status){
                case 200:
                    onSuccess(this.response);
                    break;
                case 404:
                    onError();
                    break;
            }
        }
    });
    request_.send();
}

/**
 * Load resource.
 * @param index
 * @param resource
 * @param onSuccess
 * @param onError
 * @param strict
 */
function loadResource(index,resource,onSuccess,onError,strict){
    let type = resource.type;
    let src  = resource.src;

    if(!src){
        console.log(`Warning: Resource ${type ? `of type '${type}'` : ''} ${index !== null ? `at index ${index}` : ''} has no path.`);
        return;
    }

    src  = path.normalize(src);
    type = type || 'text';

    if(type !== 'text' &&
        type !== 'image' &&
        type !== 'svg' &&
        type !== 'json' &&
        type !== 'video' &&
        type !== 'arraybuffer'){
        console.log(`Warning: Resource '${src}' of type '${type}' ${index !== null ? `at index ${index}` : ''} is not supported.`);
    }

    function onSuccess_(response){
        onSuccess(index,src,response);
    }

    function onError_(){
        console.log(`Warning: Failed to load resource '${src}' of type '${type}' ${index !== null ? `at index ${index}` : ''}.`);
        if(strict){
            onError(src);
        }
    }

    switch(type){
        case 'image':
            const image = new Image();
            image.addEventListener('load',()=>{
                onSuccess_(image);
            });
            image.addEventListener('error',onError_);
            image.src = src;
            break;

        case 'json':
            request(src,type, function(response){
                onSuccess_(JSON.parse(response));
            },onError_);
            break;

        case 'svg':
            request(src,'text',function(response){
                const div = document.createElement('div');
                div.innerHTML = response;
                onSuccess_(div.children[0]);
            });
            break;

        case 'video':
            const video  = document.createElement('video');
            const source = document.createElement('source');

            let videoType = path.extname(src).substring(1);
            switch(videoType){
                case 'ogm':
                case 'ogv':
                    videoType = 'ogg';
                    break;
                case 'ogg':
                case 'mp4':
                case 'webm':
                    break;
                default:
                    throw new Error(`Video type not supported '${videoType}'`);
                    break;
            }

            const onVideoSuccess = ()=>{
                video.removeEventListener('canplaythrough',onVideoSuccess);
                onSuccess_(video);
            };

            //chrome/firefox
            video.addEventListener('canplaythrough', onVideoSuccess);

            video.setAttribute('muted','');
            video.setAttribute('preload','');
            video.setAttribute('loop','');
            video.setAttribute('muted','');

            source.setAttribute('type',`video/${videoType}`);
            source.setAttribute('src',src);

            video.appendChild(source);
            break;

        default:
            request(src,type,onSuccess_,onError_);
            break;
    }
}

/**
 * Loads resource bundle.
 * @param bundle
 * @param cb
 * @param [cbProcess]
 * @param [strict]
 * @example
 * loadResources({
 *     item0 : {type:'text',src:'path/to/item0.txt'},
 *     item1 : {type:'image',src:'path/to/item1.png'},
 *     item2 : {type:'video',src:'path/to/item2.mp4'},
 *     item3 : {type:'json',src:'path/to/item3.json'},
 *     item4 : {type:'svg',src:'path/to/item4.svg'}
 * },(err,res)=>{
 *     if(err){
 *         throw err;
 *     }
 *     const text = res.item0;
 *     const image = res.item1;
 *     const video = res.item2;
 *     const json = res.item3;
 *     const svg = res.item4;
 * });
 */
export default function loadResources(bundle,cb,cbProcess,strict){
    strict = strict === undefined ? true : strict;
    cbProcess = cbProcess || noop;

    const keys   = Object.keys(bundle);
    let numFiles = keys.length;

    const resources = {};

    //no resources, go
    if(numFiles === 0){
        cb(null,resources);
        return;
    }

    let numFilesLoaded = 0;
    let error = false;

    function onFileProcessed(index,num,src){
        cbProcess({
            index : index - 1,
            num : num,
            src : src
        });
        if(index === num){
            cb(null,resources);
        }
    }

    function onError_(e){
        if(!strict){
            numFiles--;
            onFileProcessed();
            return;
        }
        cb(e,null);
        error = true;
    }

    let index = 0;
    for(let resource in bundle){
        loadResource(index++,bundle[resource],
            function(index,src,resource){
                resources[keys[index]] = resource;
                numFilesLoaded++;
                onFileProcessed(numFilesLoaded,numFiles,src);
            },
            onError_,
            strict
        );
        if(error){
            return;
        }
    }
}
