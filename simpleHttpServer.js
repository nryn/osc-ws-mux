import http from 'http'
import fs from 'fs'
import path from 'path'

// used for serving files for the admin page

export const serve = (baseDir, port) => {
    console.log(`Setting up Simple HTTP Server`)
    http.createServer((request, response) => {
        const filePath = request.url == '/' ? `${baseDir}/index.html` : `${baseDir}${request.url}`
    
        const mimeTypes = {
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon'
        }
    
        const contentType = mimeTypes[path.extname(filePath)] || 'application/octet-stream'
    
        fs.readFile(filePath, (error, content) => {
            if (error) {
                if (error.code == 'ENOENT') {
                    response.writeHead(404, { 'Content-Type': 'text/html' })
                    response.end(`404: ${request.url} not found.`, 'utf-8')
                } else {
                    response.writeHead(500)
                    response.end('Sorry, check with the site admin for error: '+error.code+' ..\n')
                }
            } else {
                response.writeHead(200, { 'Content-Type': contentType })
                response.end(content, 'utf-8')
            }
        })
    
    }).listen(port)
    
    console.log(`Simple HTTP Server running at localhost:${port}`)
}
