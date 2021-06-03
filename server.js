const Koa = require("koa")
const app = new Koa()
const Route = require("koa-router")
const router = new Route()
const cors = require("koa2-cors")
const koaBody = require("koa-body")
const koaStatic = require("koa-static")
const fs = require("fs")
const path = require("path")

app.use(cors({
  origin: "*",
  maxAge: 5,
  credentials: true,
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "Accept"],
  exposeHeaders: ["WWW-Authenticate", "Server-Authorization"]
}))

app.use(koaStatic(path.resolve(__dirname, "static")))

app.use(koaBody({
  multipart: true,
  formLimit: 1024 * 1024 * 1024 * 10
}))

app.use(router.routes()).use(router.allowedMethods())

router.get("/", ctx => {
  ctx.body = 222
})

router.get("/file", async ctx => {
  const file = await fs.readFileSync(path.resolve(__dirname, 'upload/img.png'))
  ctx.body = file
})

const statusEnum = [
  {
    code: 200,
    msg: '上傳成功',
    success: true,
    errorList: {

    }
  },
  {
    errorMsg: '导入失败，存在错误数据，请下载导入错误结果查看错误原因修正后，可上传该文件重新导入',
    success: false,
    errorList: {
      failPath: 'http://localhost:5000/file',
    }
  },
  {
    success: false,
    errorMsg: '导入失败，存在错误数据，请下载导入错误结果查看错误原因修正后，可上传该文件重新导入',
    errorList: {
      failPath: 'http://localhost:5000/file',
    }
  }
]
router.post("/test", async ctx => {
  // const file = ctx.request.files.file;
  try {
    // await upload(file)
    // console.log(file);
    const random = Math.floor(Math.random() * 3)
    ctx.body = statusEnum[1]
  } catch (error) {
    console.log(error);
    ctx.body = statusEnum[2]
  }

})

function upload(file) {
  return new Promise((resolve, reject) => {
    let render = fs.createReadStream(file.path);
    const write = fs.createWriteStream(path.resolve(__dirname, `upload/${file.name}`))
    render.pipe(write)
    write.on('finish', () => {
      resolve(true)
    })
    write.on('error', (error) => {
      reject(error)
    })
  })
}

router.post("/upload/chunks", async ctx => {
  await uploadChunks(ctx.request.files, ctx.request.body)
  // await mergeChunks(ctx.request.body.filename, ctx.request.body.chunkCount)
  ctx.body = true
})

router.post("/upload/merge", async ctx => {
  const { filename, extName } = ctx.request.body
  console.log(filename)
  await mergeChunks(filename, extName)
  ctx.body = {
    filename,
    extName,
    url: `${ctx.protocol}://${ctx.host}/${filename}${extName}`
  }
})

async function uploadChunks(file, fields) {
  const chunk = file.chunk
  const filename = fields.filename
  const hash = fields.hash
  const isExistUpload = await fs.existsSync(path.resolve(__dirname, `upload`))
  if(!isExistUpload) {
    await fs.mkdirSync(path.resolve(__dirname, `upload`))
  }
  const isExist = await fs.existsSync(path.resolve(__dirname, `upload/${filename}`))
  if(!isExist) {
    await fs.mkdirSync(path.resolve(__dirname, `upload/${filename}`))
  }
  const renader = fs.createReadStream(chunk.path)
  const write = fs.createWriteStream(path.resolve(__dirname, `upload/${filename}/${hash}`))
  await renader.pipe(write)
  write.on("finish", () => console.log('ok...'))
}

async function mergeChunks(filename, extName) {
  const existDir = fs.existsSync(path.resolve(__dirname, `upload/${filename}`))
  if(!existDir) return
  const isExistStatic = await fs.existsSync(path.resolve(__dirname, `static`))
  if(!isExistStatic) {
    await fs.mkdirSync(path.resolve(__dirname, `static`))
  }
  const chunksPath = fs.readdirSync(path.resolve(__dirname, `upload/${filename}`))
  chunksPath.sort((a, b) => a.split("-")[1] - b.split("-")[1])
  const pipeStream = (path, writeStream) => new Promise((resolve) => {
    const readStream = fs.createReadStream(path)
    readStream.pipe(writeStream)
    readStream.on("end", () => {
      fs.unlinkSync(path)
      readStream.close()
      resolve()
    })
  })
  await Promise.all(
    chunksPath.map((chunkPath, index) => pipeStream(
      path.resolve(__dirname, `upload/${filename}/${chunkPath}`),
      fs.createWriteStream(
        path.resolve(__dirname, `static/${filename}${extName}`),
        {
          start: index * 1024 * 1024 * 5,
        }
      )
    ))
  )

  await setTimeout(() => {}, 1000 * 5)

  await fs.rmdirSync(path.resolve(__dirname, `upload/${filename}`))
}


app.listen(8562, () => console.log('http://localhost:8562'))
