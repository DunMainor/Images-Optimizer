const electron = require("electron");
const app = electron.app
const BrowserWindow = electron.BrowserWindow
const ipcMain = electron.ipcMain
const { readdirSync } = require('fs')
const isImage = require('is-image')
const recursive = require("recursive-readdir")
const Jimp = require('jimp')
const path = require("path");
const isDev = require("electron-is-dev");

let mainWindow;
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 800,
        resizable: false,
        webPreferences: {
            nodeIntegration: true,
            preload: __dirname + '/preload.js'
        }
    });
    mainWindow.loadURL(
        isDev
            ? "http://localhost:3000"
            : `file://${path.join(__dirname, "../build/index.html")}`
    );
    mainWindow.on("closed", () => (mainWindow = null));
    // isDev ? mainWindow.webContents.openDevTools() : null

}

getDirectories = (root_dir) =>
    readdirSync(root_dir, { withFileTypes: true })
        .filter(child_dir => child_dir.isDirectory())
        .map(child_dir => `${root_dir}\\${child_dir.name}`)

readFilesRecursive = (directory) => {
    return new Promise((resolve, reject) => {
        recursive(`${directory}`, function (err, files) {
            if (err) {
                // console.log('Got an error: ', err)
                reject('Error Occured: ', err)
            } else {
                resolve(files)
            }
        })
    })
}

findFiles = async (directoriesArray) => {
    let index = 0
    let files_array = []
    let errors_array = []
    return await Promise.all(directoriesArray.map(async (directory) => {
        index++
        return await readFilesRecursive(directory).then(async (files) => {
            // console.log(`We successfully mined directory ${index} with files ${files.length}`)
            return { files, errors: null }
        }).catch((error) => {
            // console.log('There was an error reading the directories. Try Again')
            return { files: null, error }
        })
    }))
}

optimizeImage = (image_path, width = 700, height = 700) => {
    return new Promise(async (resolve, reject) => {
        Jimp.read(image_path)
            .then(image_file => {
                image_file.autocrop(10).cover(width, height) // resize
                    .quality(80) // set JPEG quality
                resolve(image_file)
            })
            .catch(err => {
                // console.log('caught an error: ', err)
                reject(err)
            })
    })
}

optimizeImages = async (image_files, dimensions) => {
    return await Promise.all(
        image_files.map(async (original_image_path, index) => {
            return await optimizeImage(original_image_path, dimensions.width, dimensions.height).then((optimized_image) => {
                let file_name = original_image_path.split('\\').pop()
                let file_dir = original_image_path.split('\\').slice(0, -1).join('\\')
                let optimized_image_path = `${file_dir}/optimized/${file_name}`
                optimized_image.write(optimized_image_path) // save
                // console.log('Logging optimized image: ', file_name)
                mainWindow.send('OPTIMIZATION_PERCENT', { percent: Math.floor((index + 1) / image_files.length) * 100 })
                return { image: { original_image_path, optimized_image_path }, error: null }
            }).catch((error) => {
                mainWindow.send('OPTIMIZATION_PERCENT', { percent: Math.floor((index + 1) / image_files.length) * 100 })
                return { image: null, error: error }
            })
        })
    )
}

ipcMain.on('FOLDER_PATH', async (event, params) => {
    const directories = getDirectories(params.folder_path)
    const directories_array = directories.length > 0 ? directories : [params.folder_path]
    // console.log('Found these Directories: ', directories_array)

    mainWindow.send('DIRECTORIES', { directories_array })
    const found_files = await findFiles(directories_array)
    // console.log('Found these files: ', found_files)
    if (Array.isArray(found_files)) {
        let files_paths_array = await Promise.all(found_files.map(async (files_obj) => {
            return await Promise.all(files_obj.files.filter((file) => { return isImage(file) }).map(file_path => file_path))
        })
        )
        let original_images_paths = [].concat(...files_paths_array)
        let optimized_images_paths = 'Pending '.repeat(original_images_paths.length).split(' ').slice(0, -1)
        let combined_file_paths = { original_images_paths, optimized_images_paths }
        // console.log('Found these files Paths: ', combined_file_paths)

        mainWindow.send('FILE_PATHS', { combined_file_paths })
    }
})

ipcMain.on('OPTIMIZE_IMAGES', async (event, params) => {
    let original_images_paths = params.original_images_paths
    let dimensions = params.dimensions
    let optimized_images = await optimizeImages(original_images_paths, dimensions)
    // console.log('Received file paths: ', original_images_paths)
    if (Array.isArray(optimized_images)) {
        let original = optimized_images.filter(transorm_obj => transorm_obj.error === null).map(transorm_obj => transorm_obj.image.original_image_path)
        let optimized = optimized_images.filter(transorm_obj => transorm_obj.error === null).map(transorm_obj => transorm_obj.image.optimized_image_path)
        let combined_file_paths = { original_images_paths: original, optimized_images_paths: optimized }
        // console.log('Transform complete: !')
        mainWindow.send('OPTIMIZATION_COMPLETE', { combined_file_paths })
    }
})

app.on("ready", createWindow);
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});
app.on("activate", () => {
    if (mainWindow === null) {
        createWindow();
    }
});

