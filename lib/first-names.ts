// Common US first names, used by privacy mode to spot "First Last" inside free text.
// First names that are also everyday words (May, Will, Grace, Mark, Bill, Hope…) are left
// out on purpose so phrases like "May Update" aren't mistaken for names.
export const FIRST_NAMES = new Set(`
aaron abigail adam adrian adriana aidan aiden alan albert alec alejandro alex alexa alexander alexandra alexis
alfred alice alicia alison allen allison alyssa amanda amber amelia amy ana andre andrea andres andrew andy
angela angelica angie anita ann anna anne annette annie anthony antonio arthur ashley audrey ava barbara barry
beatrice becky ben benjamin bernard beth bethany betty beverly billy blake bobby bonnie brad bradley brandon
brenda brendan brett brian briana brianna bridget brittany brooke bruce bryan caleb calvin cameron camila carl
carla carlos carmen carol carole caroline carolyn carrie casey cassandra catherine cathy cecilia chad charlene
charles charlie charlotte chelsea cheryl chris christian christina christine christopher cindy claire clara
clarence claudia clayton clifford clinton cody colin colleen connie connor courtney craig crystal curtis
cynthia daisy dale dakota dalton damian dan dana daniel danielle danny darlene darren darryl dave david dean
deanna debbie deborah debra denise dennis derek derrick desiree devin diana diane dianne dominic don donald
donna doris dorothy douglas dustin dwayne dylan eddie edgar edith eduardo edward edwin eileen elaine eleanor
elena eli elijah elisa elizabeth ella ellen ellie elsie emily emma eric erica erik erin ernest esther ethan
eugene eva evan evelyn felicia felix fernando florence frances francis francisco frank franklin fred freda
frederick gabriel gabriela gabrielle gail gary gavin gene george gerald geraldine gina gladys glen glenda
glenn gloria gordon greg gregory gwen hailey haley hannah harold harry harvey hazel heather hector heidi helen
henry herbert holly howard hunter ian irene isaac isabel isabella isaiah ivan jack jackie jackson jacob
jacqueline jaime jake james jamie jan jane janet janice jared jasmine jason javier jay jean jeanette jeanne
jeff jeffery jeffrey jenna jennifer jenny jeremiah jeremy jerome jerry jesse jessica jesus jill jim jimmy jo
joan joann joanna joanne jodi jody joe joel johanna john johnny jon jonathan jordan jorge jose joseph
josephine josh joshua joyce juan juanita judith judy julia julian julie julio justin kaitlyn karen karina karl
kate katelyn katherine kathleen kathryn kathy katie katrina kay kayla keith kelly kelsey ken kendra kenneth
kenny kevin kim kimberly kirk kristen kristin kristina kristy kurt kyle lance larry laura lauren laurie leah
lee leon leonard leroy leslie lester lillian lily linda lindsay lindsey lisa logan lois lonnie lori lorraine
louis louise lucas lucy luis luke lydia lynn mackenzie madeline madison maggie manuel marc marcia marcus
margaret maria marian marie marilyn mario marion marissa marjorie marlene marsha martha martin marvin mary
mason mathew matt matthew maureen maurice max megan melanie melinda melissa melvin michael michele michelle
miguel mike mildred miranda missy mitchell molly monica morgan nancy naomi natalie natasha nathan nathaniel
neil nelson nicholas nichole nick nicole noah nora norma norman olivia oscar pamela patricia patrick patty
paul paula pedro peggy penny peter philip phillip phyllis rachel ralph ramon randall randy raul ray raymond
rebecca regina renee rhonda ricardo richard rick ricky rita robert roberta roberto robin rodney roger ron
ronald ronnie rosa rosemary roy ruben russell ruth ryan sabrina sally samantha samuel sandra sara sarah scott
sean sergio seth shane shannon sharon shawn sheila shelby shelly sherry shirley sierra sofia sonia sophia
stacey stacy stanley stephanie stephen steve steven sue susan suzanne sylvia tamara tammy tanya tara taylor
ted teresa terri terry theodore theresa thomas tiffany tim timothy tina todd tom tommy toni tony tracy travis
trevor troy tyler valerie vanessa veronica vicki vickie victor vincent virginia vivian walter wanda warren
wayne wendy wesley whitney william willie yolanda yvonne zachary zoe
`.split(/\s+/).filter(Boolean));
