import React, { Component } from "react"
import axios from "axios"
import './App.css';

const xhr = axios.create({
  baseURL: "http://localhost:5000",
  timeout: 6000 * 60
})

/**
 * 生產文件
 * @param {Function(file)} cb 回調函數
 */
const produceFile = (cb) => {
  const input = document.createElement("input")
  input.setAttribute("type", "file")
  input.click();
  input.addEventListener("change", function() {
    cb(this.files[0])
  })
}

const isAllowedFileType = (file) => {
  const extReg = /(\.[^.]+)$/
  extReg.test(file.name)
  return RegExp.$1
}

/**
 * 創建文件切片
 * @param {File} file 目標文件
 * @param {number} chunkSize 切片大小
 * @returns Array<Blob|Buffer>
 */
const createFileChunks = (file, chunkSize) => {
  const fileChunkList = []
  let chunkIndex = 0
  while(chunkIndex < file.size) {
    fileChunkList.push(file.slice(chunkIndex, chunkSize + chunkIndex))
    chunkIndex += chunkSize
  }
  return fileChunkList
}

const FILE_CHUNK_SIZE = 1024 * 1024 * 5

class App extends Component{
  filename = ""
  extName = ""
  progress = 0;
  fileSize = 0;

  state = {
    datalist: [],
  }

  handleChangeFile = async (file) => {
    const extName = await isAllowedFileType(file)
    const fileChunks = createFileChunks(file, FILE_CHUNK_SIZE)
    const hash = await this.createHash(fileChunks)
    this.filename = hash
    this.extName = extName
    this.fileSize = file.size
    const datalist = fileChunks.map((blob, index) => ({
      chunk: blob,
      fileName: hash,
      extName,
      hash: hash + "-" + index,
    }))
    this.setState({
      datalist,
    })
    await this.handleUpload()
    console.log(this.state.datalist);
  }

  handleUpload = async () => {
    const self = this
    const requestList = this.state.datalist.map(({ chunk, hash, fileName, extName }) => {
      const formData = new FormData()
      formData.append("chunk", chunk)
      formData.append("hash", hash)
      formData.append("filename", fileName)
      formData.append("extName", extName)
      formData.append("chunkCount", this.state.datalist.length)
      return { formData }
    }).map(({ formData }) => xhr({
      url: "/upload/chunks",
      method: "POST",
      data: formData,
      headers: {
        Accept: ' */*',
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress(progress) {
        console.log(progress);
        self.calcProgress(progress.loaded)
      }
    }))

    await Promise.all(requestList)
    await this.handleMerge(this.filename, this.extName)
  }

  createHash = (fileChunks) => {
    return new Promise((resolve) => {
      const worker = new Worker("/hash-worker.js")
      worker.postMessage({ fileChunks })
      worker.onmessage = e => {
        const { percentage, hash } = e.data
        console.log(percentage, hash);
        if(hash) {
          resolve(hash)
        }
      }
    })
  }

  handleMerge = (filename, extName) => {
    xhr({
      method: "POST",
      url: "/upload/merge",
      data: {
        filename,
        extName,
      }
    })
  }

  calcProgress = (progress) => {
    this.progress += progress
    // console.log(Math.floor(this.progress / this.fileSize * 100) + '%', this.fileSize)
  } 

  render() {
    return (
      <div className="App">
        <button onClick={() => produceFile(this.handleChangeFile)}>選擇文件</button>
        <div>
          <ul>
            {
              this.state.datalist.map(item => {
                return <li key={item.hash}>{ item.hash }</li>
              })
            }
          </ul>
        </div>
      </div>
    );
  }
}

export default App;
