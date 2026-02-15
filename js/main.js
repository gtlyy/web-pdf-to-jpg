// 设置pdf.js worker路径
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js';

document.addEventListener('DOMContentLoaded', function() {
    // 页面元素
    const pdfFileInput = document.getElementById('pdfFile');
    const fileNameSpan = document.getElementById('fileName');
    const fileArea = document.getElementById('fileArea');
    const startPageInput = document.getElementById('startPage');
    const endPageInput = document.getElementById('endPage');
    const startPageUpBtn = document.getElementById('startPageUp');
    const startPageDownBtn = document.getElementById('startPageDown');
    const endPageUpBtn = document.getElementById('endPageUp');
    const endPageDownBtn = document.getElementById('endPageDown');
    const imagePrefixInput = document.getElementById('imagePrefix');
    const qualitySelect = document.getElementById('quality');
    const createMergedCheckbox = document.getElementById('createMerged');
    const mergeOptionsDiv = document.getElementById('mergeOptions');
    const convertBtn = document.getElementById('convertBtn');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const resultSection = document.getElementById('resultSection');
    const resultImagesDiv = document.getElementById('resultImages');
    const mergedImageContainer = document.getElementById('mergedImageContainer');
    const mergedImage = document.getElementById('mergedImage');
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    
    // 全局变量
    let pdfDoc = null;
    let allPageImages = [];
    
    // 文件选择事件
    pdfFileInput.addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
            fileNameSpan.textContent = e.target.files[0].name;
            // 自动设置最大页数
            const file = e.target.files[0];
            loadPdfPreview(file);
        } else {
            fileNameSpan.textContent = '点击此处选择PDF文件';
        }
    });
    
    // 点击文件区域也可以选择文件
    fileArea.addEventListener('click', function(e) {
        if (e.target !== pdfFileInput) {
            pdfFileInput.click();
        }
    });
    
    // 切换合并选项显示
    createMergedCheckbox.addEventListener('change', function() {
        if (this.checked) {
            mergeOptionsDiv.classList.remove('hidden');
        } else {
            mergeOptionsDiv.classList.add('hidden');
        }
    });
    
    // 开始转换事件
    convertBtn.addEventListener('click', startConversion);
    
    // 起始页增减按钮
    startPageUpBtn.addEventListener('click', function() {
        const currentValue = parseInt(startPageInput.value) || 0;
        startPageInput.value = currentValue + 1;
    });
    
    startPageDownBtn.addEventListener('click', function() {
        const currentValue = parseInt(startPageInput.value) || 1;
        if (currentValue > 1) {
            startPageInput.value = currentValue - 1;
        }
    });
    
    // 结束页增减按钮
    endPageUpBtn.addEventListener('click', function() {
        const currentValue = parseInt(endPageInput.value) || 0;
        endPageInput.value = currentValue + 1;
    });
    
    endPageDownBtn.addEventListener('click', function() {
        const currentValue = parseInt(endPageInput.value) || 0;
        if (currentValue > 0) {
            endPageInput.value = currentValue - 1;
        }
    });
    
    // 鼠标滚轮调整页码
    startPageInput.addEventListener('wheel', function(e) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 1 : -1;
        const currentValue = parseInt(this.value) || 0;
        this.value = Math.max(1, currentValue + delta);
    });
    
    endPageInput.addEventListener('wheel', function(e) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 1 : -1;
        const currentValue = parseInt(this.value) || 0;
        this.value = Math.max(0, currentValue + delta);
    });
    
    // 加载PDF并预览页数
    async function loadPdfPreview(file) {
        try {
            const typedArray = new Uint8Array(await file.arrayBuffer());
            pdfDoc = await pdfjsLib.getDocument(typedArray).promise;
            const totalPages = pdfDoc.numPages;
            endPageInput.placeholder = `留空表示最后一页 (${totalPages})`;
        } catch (error) {
            console.error('加载PDF预览失败:', error);
            alert('无法读取PDF文件，请确认文件格式是否正确');
        }
    }
    
    // 开始转换
    async function startConversion() {
        // 检查是否选择了文件
        if (pdfFileInput.files.length === 0) {
            alert('请先选择一个PDF文件');
            return;
        }
        
        const file = pdfFileInput.files[0];
        if (!file.name.toLowerCase().endsWith('.pdf')) {
            alert('请选择PDF文件');
            return;
        }
        
        // 获取参数
        const startPage = parseInt(startPageInput.value) || 1;
        const endPage = parseInt(endPageInput.value) || null; // null表示到最后一页
        const imagePrefix = imagePrefixInput.value || 'page_';
        const quality = parseInt(qualitySelect.value) || 300;
        const createMerged = createMergedCheckbox.checked;
        
        // 参数验证
        try {
            const typedArray = new Uint8Array(await file.arrayBuffer());
            pdfDoc = await pdfjsLib.getDocument(typedArray).promise;
            const totalPages = pdfDoc.numPages;
            
            // 验证页码范围
            if (startPage < 1 || startPage > totalPages) {
                throw new Error(`起始页必须在1到${totalPages}之间`);
            }
            
            const effectiveEndPage = endPage ? Math.min(endPage, totalPages) : totalPages;
            if (effectiveEndPage < startPage || effectiveEndPage > totalPages) {
                throw new Error(`结束页必须在${startPage}到${totalPages}之间`);
            }
            
            // 显示进度条
            progressContainer.classList.remove('hidden');
            resultSection.classList.add('hidden');
            
            // 执行转换
            await convertPdfToImages(pdfDoc, startPage, effectiveEndPage, imagePrefix, quality, createMerged);
            
        } catch (error) {
            console.error('转换过程中发生错误:', error);
            alert(`转换失败: ${error.message}`);
            progressContainer.classList.add('hidden');
        }
    }
    
    // 执行PDF到图片的转换
    async function convertPdfToImages(pdf, startPage, endPage, prefix, quality, createMerged) {
        allPageImages = [];
        const totalPageCount = endPage - startPage + 1;
        
        // 设置缩放比例，基于DPI计算
        // 默认DPI是72，所以缩放因子是 quality/72
        const scale = quality / 72;
        
        for (let i = 0; i < totalPageCount; i++) {
            const pageNum = startPage + i;
            
            // 更新进度
            const progress = ((i + 1) / totalPageCount) * 50;
            updateProgress(`正在转换第 ${pageNum} 页...`, progress);
            
            // 渲染PDF页面
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: scale });
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };
            
            await page.render(renderContext).promise;
            
            // 保存图片数据
            const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9); // JPEG格式，高质量
            const filename = `${prefix}${pageNum}.jpg`;
            allPageImages.push({
                dataUrl: imageDataUrl,
                filename: filename,
                pageNum: pageNum
            });
            
            // 清除canvas以释放内存
            canvas.width = 0;
            canvas.height = 0;
        }
        
        // 显示所有生成的图片
        displayResults(createMerged);
        
        if (createMerged) {
            updateProgress('正在合并图片...', 75);
            const mergeDirection = document.getElementById('mergeDirection').value;
            const mergedImageUrl = await mergeImages(allPageImages, mergeDirection);
            
            mergedImage.src = mergedImageUrl;
            mergedImageContainer.classList.remove('hidden');
        }
        
        updateProgress('转换完成！', 100);
        
        // 启用下载所有按钮
        downloadAllBtn.onclick = downloadAllImages;
    }
    
    // 显示结果
    function displayResults(showMerged) {
        resultImagesDiv.innerHTML = '';
        
        allPageImages.forEach(imgData => {
            const imgElement = document.createElement('img');
            imgElement.src = imgData.dataUrl;
            imgElement.alt = imgData.filename;
            imgElement.title = `第${imgData.pageNum}页`;
            resultImagesDiv.appendChild(imgElement);
        });
        
        resultSection.classList.remove('hidden');
    }
    
    // 合并图片
    async function mergeImages(images, direction) {
        return new Promise((resolve) => {
            // 加载所有图片
            const imgObjects = images.map(imgData => {
                const img = new Image();
                img.src = imgData.dataUrl;
                return img;
            });
            
            // 等待所有图片加载完成
            Promise.all(imgObjects.map(img => new Promise(resolve => {
                if (img.complete) {
                    resolve();
                } else {
                    img.onload = resolve;
                    img.onerror = () => resolve(); // 即使出错也继续
                }
            }))).then(() => {
                // 创建画布来合并图片
                let maxWidth = 0;
                let maxHeight = 0;
                
                if (direction === 'horizontal') {
                    // 水平方向：总宽度是所有图片宽度之和，高度是最高图片的高度
                    maxWidth = imgObjects.reduce((sum, img) => sum + img.width, 0);
                    maxHeight = Math.max(...imgObjects.map(img => img.height));
                } else {
                    // 垂直方向：宽度是最宽图片的宽度，高度是所有图片高度之和
                    maxWidth = Math.max(...imgObjects.map(img => img.width));
                    maxHeight = imgObjects.reduce((sum, img) => sum + img.height, 0);
                }
                
                const canvas = document.createElement('canvas');
                canvas.width = maxWidth;
                canvas.height = maxHeight;
                const ctx = canvas.getContext('2d');
                
                // 绘制图片
                let currentX = 0;
                let currentY = 0;
                
                imgObjects.forEach(img => {
                    if (direction === 'horizontal') {
                        ctx.drawImage(img, currentX, 0, img.width, img.height);
                        currentX += img.width;
                    } else {
                        ctx.drawImage(img, 0, currentY, img.width, img.height);
                        currentY += img.height;
                    }
                });
                
                // 返回合并后的图片数据URL
                resolve(canvas.toDataURL('image/jpeg', 0.9));
            });
        });
    }
    
    // 更新进度显示
    function updateProgress(text, percent) {
        progressText.textContent = text;
        progressBar.style.width = `${percent}%`;
    }
    
    // 下载所有图片
    function downloadAllImages() {
        allPageImages.forEach(imgData => {
            const link = document.createElement('a');
            link.href = imgData.dataUrl;
            link.download = imgData.filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
        
        // 如果有合并图片，也提供下载
        if (!mergedImageContainer.classList.contains('hidden')) {
            const mergedLink = document.createElement('a');
            mergedLink.href = mergedImage.src;
            mergedLink.download = document.getElementById('outputMergedName').value || 'all-in-one.jpg';
            document.body.appendChild(mergedLink);
            mergedLink.click();
            document.body.removeChild(mergedLink);
        }
    }
});