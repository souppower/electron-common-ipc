window.addEventListener('load', () => {
    let url1 = 'CommonView.html'
    url1 += '?title=Frame';
    url1 += '&type=renderer';
    url1 += '&id=1';
    url1 += '&peerName=Frame_1';
    url1 += '&webContentsId=3';
    document.getElementById('content1').src = url1;
    let url2 = 'CommonView.html'
    url2 += '?title=Frame';
    url2 += '&type=renderer';
    url2 += '&id=1';
    url2 += '&peerName=Frame_2';
    url2 += '&webContentsId=3';
    document.getElementById('content2').src = url2;
});