export const site = {name:'往事.未完', description:'保持好奇，信号在线，故事未完。'};
export const href = (path='') => `${import.meta.env.BASE_URL.replace(/\/$/,'')}/${path.replace(/^\//,'')}`;
export const rooms = [
  {path:'archive/', label:'文字的回声', en:'JOURNAL', number:'01', description:'把经过的日子，写成可以重返的地方。'},
  {path:'music/', label:'月光音乐馆', en:'LISTENING ROOM', number:'02', description:'让这一刻，慢一点。'},
  {path:'anime/', label:'故事放映室', en:'ANIME ARCHIVE', number:'03', description:'那些不愿散场的故事。'},
  {path:'space/', label:'关于这片宇宙', en:'A LITTLE ABOUT ME', number:'04', description:'代码、幻想，和生活里的微小光亮。'}
];
