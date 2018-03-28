var mysql = require('mysql');
var pool  = mysql.createPool({
  host     : '127.0.0.1',
  user     : 'root',
  password : 'root',
  database : 'knowledge'
});

//七牛获取uptoken
//七牛云存储
var qiniu = require('qiniu');
var bucket = 'exercise-pic';
//七牛key
qiniu.conf.ACCESS_KEY = "oJ6oH5Zzo6e_dW21Q4UKCnmwCRwfJ9OaqlC9yK5k";
qiniu.conf.SECRET_KEY = "Fkau1rsZ1I7CuoMJ6Ns1UfwPljrXeAWr-ecqGwSS";




module.exports = function(app){
//处理GET请求
//http://127.0.0.1:3000/hello/?name=wujintao&email=cino.wu@gmail.com 


app.get('/klmanager/qiniu/getToken', function(req, res){
    var currentKey = new Date().getTime().toString();
    var myUptoken = new qiniu.rs.PutPolicy(bucket);
    var token = myUptoken.token();
    res.header("Cache-Control", "max-age=0, private, must-revalidate");
    res.header("Pragma", "no-cache");
    res.header("Expires", 0);
    if (token) {
        res.json({
            uptoken: token,
            savakey: currentKey
        });
    }

});

app.post('/klmanager/qiniu/delPic', function(req, res){
    console.log(req.body);
    if(req.body.key){
        //构建bucketmanager对象
        var client = new qiniu.rs.Client();
        //删除资源
        client.remove(bucket, req.body.key, function(err, ret) {
          if (!err) {
            // ok
            res.send({status: 'success'});
          } else {
            res.status(400).send({status: 'server error'});
            console.log(err);
          }
        });
    }
});

}
//app.get('/', function(req, res){  
// res.render('index', {  
//    title: 'Express'  
//  });  
//});  
//上面的代码意思是，get请求根目录则调用views文件夹中的index模板，并且传入参数title为“Express”，这个title就可以在模板文件中直接使用