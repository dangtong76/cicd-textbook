document.addEventListener('DOMContentLoaded', (event) => {
  document.querySelectorAll('pre > code').forEach((codeBlock) => {
      const button = document.createElement('button');
      button.className = 'copy-button';
      button.type = 'button';
      button.innerText = '복사';

      button.addEventListener('click', () => {
          navigator.clipboard.writeText(codeBlock.innerText).then(() => {
              button.blur();
              button.innerText = '복사됨!';
              setTimeout(() => {
                  button.innerText = '복사';
              }, 2000);
          }, (error) => {
              button.innerText = '오류';
          });
      });

      const pre = codeBlock.parentNode;
      pre.parentNode.insertBefore(button, pre);
  });
});