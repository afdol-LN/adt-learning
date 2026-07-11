import { createHash, randomBytes } from 'crypto';

export class Hash {
    salt : string;
    hash : string;
    constructor(){
        this.salt = "67"
    }

     getSalt() :  string{
        return this.salt;
    }
    hashWithSaltAndDate(value: string, salt: string, date: string) : string{

        return createHash('sha256').update(value + salt + date).digest('hex');
    }
    hashSha256(value: string) : string{
        return createHash('sha256').update(value).digest('hex');
    }

}
