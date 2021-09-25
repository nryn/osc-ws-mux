#! /bin/bash

# install dev tools so we can compile a package ourselves
yum groupinstall -y 'Development Tools'
# make a bash profile
touch ~/.bash_profile
# install node version manager
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
echo "export NVM_DIR=~/.nvm" >> ~/.bash_profile
echo "source /.nvm/nvm.sh" >> ~/.bash_profile

# go to our app directory
cd /osc-ws-mux

# install node and deps
nvm install v16.10.0
npm install
# build from source because the AMI is missing glibc 2.28
npm install ws --build-from-source
npm install pm2@5.1.1 -g
# go
ADMIN_PAGE=true pm2 start index.js --name osc-ws-mux