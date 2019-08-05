import React from 'react';
import { MDBBtn, MDBTable, MDBTableBody, MDBTableHead } from 'mdbreact'
import LoadingOverlay from 'react-loading-overlay';


// Styles
import "@fortawesome/fontawesome-free/css/all.min.css";
import "bootstrap-css-only/css/bootstrap.min.css";
import "mdbreact/dist/css/mdb.css";
import './App.css';
// Assets
import FolderIcon from './assets/images/folder_icon.png'

// Constants
const electron = window.require("electron")
const ipcRenderer = electron.ipcRenderer

class App extends React.Component {

  state = {
    width: 700,
    height: 700,
    folder_path: '',
    directories: [],
    original_images_paths: [],
    optimized_images_paths: [],
    optimizing: false,
    optimization_percent: 0,
  }

  componentDidMount = () => {
    ipcRenderer.on('FILE_PATHS', (event, params) => {
      this.setState({
        original_images_paths: params.combined_file_paths.original_images_paths,
        optimized_images_paths: params.combined_file_paths.optimized_images_paths
      }, () => {
        // console.log('Logging from main received: ', params.combined_file_paths)
      })
    })

    ipcRenderer.on('DIRECTORIES', (event, params) => {
      this.setState({ directories: params.directories_array })
      // console.log('Logging from main received original directories: ', params.directories_array)
    })

    ipcRenderer.on('OPTIMIZATION_COMPLETE', (event, params) => {
      this.setState({
        optimizing: false,
        original_images_paths: params.combined_file_paths.original_images_paths,
        optimized_images_paths: params.combined_file_paths.optimized_images_paths
      }, () => {
        // console.log('Logging from main received optimized directories: ', params.combined_file_paths)
      })
    })

    ipcRenderer.on('OPTIMIZATION_PERCENT', (event, params) => {
      this.setState({ optimization_percent: params.percent })
      // console.log(`Optimization at: ${params.percent} percent`)
    })
  }

  optimizeImages = () => {
    // console.log('Optimize Images Initialized')
    const { width, height } = this.state
    if (this.state.original_images_paths.length > 0) {
      // console.log('Sending original paths for optimization')
      let original_images_paths = this.state.original_images_paths
      this.setState({ optimizing: true }, () => {
        ipcRenderer.send('OPTIMIZE_IMAGES', { original_images_paths, dimensions: { width, height } })
      })
    }
  }

  folderBrowsed = (event) => {
    const folder_path = event.target.files[0].path
    this.setState({ folder_path }, () => {
      ipcRenderer.send('FOLDER_PATH', { folder_path })
    })
  }

  removeDirectory = (dir) => {
    // console.log('Removing Directory: ', dir)
    const { directories, original_images_paths, optimized_images_paths, folder_path } = this.state
    const filtered_originals = original_images_paths.filter(image_path => !image_path.includes(dir))
    const filtered_directories = directories.filter(directory => directory !== dir)
    const originals_removed = original_images_paths.length - filtered_originals.length
    this.setState({
      directories: filtered_directories,
      folder_path: filtered_directories.length === 0 ? '' : folder_path,
      original_images_paths: filtered_originals,
      optimized_images_paths: optimized_images_paths[0] === 'Pending' ? optimized_images_paths.slice(originals_removed) : optimized_images_paths.filter(image_path => !image_path.includes(dir)),
    }, () => {
      // console.log('Logging optimized Image Paths after filter: ', optimized_images_paths)
    })
  }

  widthUpdated = (event) => { this.setState({ width: parseInt(event.target.value, 10) }) }
  heightUpdated = (event) => { this.setState({ width: parseInt(event.target.value, 10) }) }



  render = () => {
    const { original_images_paths, optimized_images_paths, optimizing, optimization_percent, directories, folder_path } = this.state
    return (
      <LoadingOverlay
        active={optimizing}
        spinner
        text={`Optimizing Images...`}
      >
        <div style={{ overflow: 'hidden' }} className="App" >
          <header className="App-container">
            <div className="container-fluid">
              <div className="row">
                <div id="f_column" className="card col-md-4 col-lg-4 col-sm-3">
                  {/* folder icon  */}
                  <div className="folder_icon_div">
                    <img className="img-fluid folder_icon_img" src={FolderIcon} alt="folder" />
                    <div className="custom-file" id='folder_input_div'>
                      <input type="file" className="custom-file-input" id="folderUpload" aria-describedby="inputGroupFileAddon01" directory="" webkitdirectory="" onChange={this.folderBrowsed} />
                      <label className="custom-file-label" htmlFor="folderUpload" ></label>
                    </div>
                  </div>
                  {/* <!-- folder path --> */}
                  <div className="input-group folder_path_div">
                    <input type="text" id="folder_path" className="search-query form-control" placeholder="Folder Path Here" value={folder_path} />
                  </div>
                  {/* <!-- Dimensions Table --> */}
                  <div className="row custyle dimensions_table_div">
                    <MDBTable className="table responsive table-striped table-condensed custab dimensions_table">
                      <MDBTableHead>
                        <tr>
                          <th>Width</th>
                          <th>Height</th>
                        </tr>
                      </MDBTableHead>
                      <MDBTableBody>
                        <tr>
                          <td>
                            <input onChange={this.widthUpdated} className="form-control" type="text" name="width" id="width" placeholder="700" contentEditable />
                          </td>
                          <td>
                            <input onChange={this.heightUpdated} className="form-control" type="text" name="height" id="height" placeholder="700" contentEditable />
                          </td>
                        </tr>
                      </MDBTableBody>
                    </MDBTable>
                  </div>
                  {/* <!-- Optimize Button --> */}
                  <div className="container-fluid optimize_div">
                    <MDBBtn onClick={this.optimizeImages} rounded block outline className='btn-lg' >Optimize</MDBBtn>
                  </div>
                  {/* <!-- folders table --> */}
                  <div className="row folders_table_div">
                    <MDBTable className="folders_table small responsive">
                      <MDBTableHead color='info-color' id='folders_thead' className="table_head">
                        <tr>
                          <th id='folders_thead_data' className="text-center">Folder</th>
                          <th id='folders_thead_data' className="text-center">Action</th>
                        </tr>
                      </MDBTableHead>
                      <MDBTableBody id='folders_tbody'>
                        {directories.length > 0 && directories.map(directory => (
                          <tr className='tr_folder_path' >
                            <td id='folders_tbody_data'>{directory}</td>
                            <td id='folders_tbody_data'>
                              <MDBBtn onClick={() => this.removeDirectory(directory)} className='btn btn-sm' rounded outline color="danger">Remove</MDBBtn>
                            </td>
                          </tr>
                        ))}
                      </MDBTableBody>
                    </MDBTable>
                  </div>
                </div>
                <div id="s_column" className="card col-md-8 col-lg-8 col-sm-9">
                  {/* Outputs Table */}
                  <div id="outputs_table_div">
                    <MDBTable className="table responsive custab">
                      <MDBTableHead id='output_thead' color='info-color'>
                        <tr>
                          <th id='output_thead_data' className="text-center">Original Image</th>
                          <th id='output_thead_data' className="text-center">Optimized Image</th>
                        </tr>
                      </MDBTableHead>
                      <MDBTableBody id='output_tbody'>
                        {Array.isArray(original_images_paths) && original_images_paths.length > 0 && original_images_paths.map((original_file_path, index) =>
                          (<tr id='output_tbody_row'>
                            <td id='output_tbody_data'>{original_file_path}</td>
                            <td id='output_tbody_data'>{optimized_images_paths[index]}</td>
                          </tr>)
                        )
                        }
                      </MDBTableBody>
                    </MDBTable>
                  </div>
                </div>
              </div>
            </div>
          </header>
        </div>
      </LoadingOverlay>
    );
  }

}

export default App;
